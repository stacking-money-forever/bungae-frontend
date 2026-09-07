import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import type { Participant } from "@/lib/api/types";
import {
  AuthenticatedTestRoot,
  anotherUser,
  createApi,
  deferred,
  getLatestSession,
  user,
} from "../action-page-test-utils";

import FeedbackPage from "./page";

let routeId = "demo";

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: routeId }),
}));

const questions = [
  ["기대와 실제가 얼마나 비슷했나요?", 1],
  ["얼마나 안전하게 느꼈나요?", 2],
  ["진행이 얼마나 편안했나요?", 3],
  ["다음에도 벙개를 이용하고 싶나요?", 4],
] as const;
const receipt = { id: "receipt-1", createdAt: "2026-09-07T00:00:00Z" };

function checkedIn(userId: string, displayName: string): Participant {
  return { userId, displayName, state: "CHECKED_IN", joinedAt: "2026-09-07T10:00:00Z" };
}

function postMeetupProblem(status: number, detail: string) {
  return new ApiProblemError(status, {
    type: "https://bungae.example/problems/post-meetup",
    title: "Post meetup rejected",
    status,
    detail,
    instance: "/v1/meetups/demo/impressions",
    code: status === 409 ? "DUPLICATE_POST_MEETUP_RECORD" : "INVALID_POST_MEETUP_RECORD",
    traceId: "trace-1",
  });
}

async function fillScores(comment = "비공개 의견") {
  await waitFor(() => expect(screen.getByRole("button", { name: "비공개로 제출하기" })).toBeEnabled());
  for (const [label, score] of questions) {
    fireEvent.click(within(screen.getByRole("group", { name: label })).getByRole("radio", { name: String(score) }));
  }
  fireEvent.change(screen.getByRole("textbox", { name: "비공개 의견 (선택)" }), { target: { value: comment } });
}

async function selectImpression(displayName = "서윤", tag = "친절하게 대했어요") {
  const member = await screen.findByRole("group", { name: displayName });
  fireEvent.click(within(member).getByRole("checkbox", { name: tag }));
}

function renderAuthenticated(api: BungaeApi) {
  return render(<AuthenticatedTestRoot api={api}><FeedbackPage /></AuthenticatedTestRoot>);
}

type PostMeetupMutation = "feedback" | "impressions" | "nextIntent";

function mutationSuccessText(mutation: PostMeetupMutation) {
  if (mutation === "feedback") return "비공개 피드백을 제출했어요. 운영팀만 확인할 수 있어요.";
  if (mutation === "impressions") return "참가자별 인상을 저장했어요.";
  return "다음 행동을 저장했어요.";
}

function mutationErrorText(mutation: PostMeetupMutation) {
  if (mutation === "feedback") return "피드백을 제출하지 못했어요.";
  if (mutation === "impressions") return "인상을 저장하지 못했어요. 다시 시도해 주세요.";
  return "다음 행동을 저장하지 못했어요. 다시 시도해 주세요.";
}

async function submitMutation(mutation: PostMeetupMutation) {
  if (mutation === "feedback") {
    await fillScores();
    fireEvent.click(screen.getByRole("button", { name: "비공개로 제출하기" }));
    return;
  }
  if (mutation === "impressions") {
    await selectImpression();
    fireEvent.click(screen.getByRole("button", { name: "인상 저장하기" }));
    return;
  }
  await waitFor(() => expect(screen.getByRole("button", { name: "비공개로 제출하기" })).toBeEnabled());
  fireEvent.click(screen.getByRole("radio", { name: "같은 사람들과 다시 만나기" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "다음 행동 저장하기" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "다음 행동 저장하기" }));
}

function createDeferredMutationApi(mutation: PostMeetupMutation, response: ReturnType<typeof deferred<typeof receipt>>) {
  const method = vi.fn().mockReturnValue(response.promise);
  const listParticipants = vi.fn().mockResolvedValue({ items: [checkedIn("target", "서윤")] });
  if (mutation === "feedback") return { api: createApi({ createFeedback: method, listParticipants }), method };
  if (mutation === "impressions") return { api: createApi({ createImpressions: method, listParticipants }), method };
  return { api: createApi({ createNextIntent: method, listParticipants }), method };
}

beforeEach(() => {
  routeId = "demo";
});

describe("FeedbackPage", () => {
  it("keeps unauthenticated users out of participant and post-meetup mutations", () => {
    render(<FeedbackPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("로그인 후 비공개 피드백을 제출할 수 있어요.");
    expect(screen.getByRole("button", { name: "비공개로 제출하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "인상 저장하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음 행동 저장하기" })).toBeDisabled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "나중에 답하기" })).toHaveAttribute("href", "/my-meetups");
    expect(screen.getByRole("link", { name: "이번에는 건너뛰기" })).toHaveAttribute("href", "/meetups/demo");
  });

  it("shows initial loading, filters actual checked-in non-self participants, and retries an append without duplicates", async () => {
    const participants = deferred<{ items: Participant[]; nextCursor?: string }>();
    const api = createApi({ listParticipants: vi.fn().mockReturnValueOnce(participants.promise).mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ items: [checkedIn("checked-in", "서윤"), checkedIn("next", "하늘")] }) });
    renderAuthenticated(api);

    expect(await screen.findByRole("status")).toHaveTextContent("참가자를 불러오는 중이에요.");
    await act(async () => participants.resolve({
      items: [
        checkedIn(user.id, user.displayName),
        checkedIn("checked-in", "서윤"),
        { ...checkedIn("joined", "숨김"), state: "JOINED" },
        { ...checkedIn("waitlisted", "대기"), state: "WAITLISTED" },
      ],
      nextCursor: "more",
    }));
    expect(await screen.findByRole("group", { name: "서윤" })).toBeInTheDocument();
    expect(screen.queryByText("숨김")).not.toBeInTheDocument();
    expect(screen.queryByText("대기")).not.toBeInTheDocument();
    expect(screen.queryByText(user.displayName)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "참가자 더 보기" }));
    expect(await screen.findByText("참가자를 더 불러오지 못했어요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "더 보기 재시도" }));
    expect(await screen.findByText("하늘")).toBeInTheDocument();
    expect(screen.getAllByText("서윤")).toHaveLength(1);
  });

  it("shows the initial empty participant result without inventing a target", async () => {
    const api = createApi({ listParticipants: vi.fn().mockResolvedValue({ items: [] }) });
    renderAuthenticated(api);

    expect(await screen.findByRole("status")).toHaveTextContent("인상을 남길 체크인 참가자가 없어요.");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "인상 저장하기" })).toBeDisabled();
  });

  it("retries an initial participant request failure and recovers the real result", async () => {
    const listParticipants = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [checkedIn("recovered", "복구된 참가자")] });
    const api = createApi({ listParticipants });
    renderAuthenticated(api);

    expect(await screen.findByText("참가자를 불러오지 못했어요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("group", { name: "복구된 참가자" })).toBeInTheDocument();
    expect(listParticipants).toHaveBeenLastCalledWith("demo", { limit: 20 }, "access");
  });

  it.each(["success", "error"] as const)("ignores a stale route participant %s", async (outcome) => {
    const first = deferred<{ items: Participant[] }>();
    const api = createApi({
      listParticipants: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce({ items: [checkedIn("new-route", "새 경로 참가자")] }),
    });
    const view = renderAuthenticated(api);
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(1));

    routeId = "other";
    view.rerender(<AuthenticatedTestRoot api={api}><FeedbackPage /></AuthenticatedTestRoot>);
    expect(await screen.findByRole("group", { name: "새 경로 참가자" })).toBeInTheDocument();
    if (outcome === "success") {
      await act(async () => first.resolve({ items: [checkedIn("old-route", "이전 경로 참가자")] }));
      expect(screen.queryByText("이전 경로 참가자")).not.toBeInTheDocument();
      return;
    }
    await act(async () => first.reject(new Error("old route failure")));
    expect(screen.queryByText("참가자를 불러오지 못했어요.")).not.toBeInTheDocument();
  });

  it.each(["success", "error"] as const)("ignores a stale account participant %s", async (outcome) => {
    const first = deferred<{ items: Participant[] }>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === anotherUser.id ? "access-b" : "access",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === anotherUser.id ? anotherUser : user,
      })),
      listParticipants: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce({ items: [checkedIn("new-account", "새 계정 참가자")] }),
    });
    renderAuthenticated(api);
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(1));

    await act(async () => getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }));
    expect(await screen.findByRole("group", { name: "새 계정 참가자" })).toBeInTheDocument();
    if (outcome === "success") {
      await act(async () => first.resolve({ items: [checkedIn("old-account", "이전 계정 참가자")] }));
      expect(screen.queryByText("이전 계정 참가자")).not.toBeInTheDocument();
      return;
    }
    await act(async () => first.reject(new Error("old account failure")));
    expect(screen.queryByText("참가자를 불러오지 못했어요.")).not.toBeInTheDocument();
  });

  it("validates impression boundaries and sends only real selected user IDs with one to four tags", async () => {
    const targets = Array.from({ length: 8 }, (_, index) => checkedIn(`target-${index + 1}`, `사람 ${index + 1}`));
    const createImpressions = vi.fn().mockResolvedValue(receipt);
    const api = createApi({ listParticipants: vi.fn().mockResolvedValue({ items: targets }), createImpressions });
    renderAuthenticated(api);

    await screen.findByRole("group", { name: "사람 1" });
    expect(screen.getByRole("button", { name: "인상 저장하기" })).toBeDisabled();
    for (let index = 1; index <= 7; index += 1) {
      await selectImpression(`사람 ${index}`);
    }
    const eighth = within(screen.getByRole("group", { name: "사람 8" })).getByRole("checkbox", { name: "친절하게 대했어요" });
    expect(eighth).toBeDisabled();
    const first = within(screen.getByRole("group", { name: "사람 1" }));
    fireEvent.click(first.getByRole("checkbox", { name: "시간을 잘 지켰어요" }));
    fireEvent.click(first.getByRole("checkbox", { name: "활발하게 참여했어요" }));
    fireEvent.click(first.getByRole("checkbox", { name: "서로를 존중했어요" }));

    fireEvent.click(screen.getByRole("button", { name: "인상 저장하기" }));
    await waitFor(() => expect(createImpressions).toHaveBeenCalledWith("demo", {
      impressions: [
        { recipientUserId: "target-1", tags: ["KIND", "PUNCTUAL", "ENGAGED", "RESPECTFUL"] },
        ...Array.from({ length: 6 }, (_, index) => ({ recipientUserId: `target-${index + 2}`, tags: ["KIND"] })),
      ],
    }, "access"));
  });

  it("waits for an impressions 201 receipt, blocks pending duplicates, and focuses only its receipt", async () => {
    const response = deferred<typeof receipt>();
    const createImpressions = vi.fn().mockReturnValue(response.promise);
    const api = createApi({ listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("target", "서윤")] }), createImpressions });
    renderAuthenticated(api);

    await selectImpression();
    fireEvent.click(screen.getByRole("button", { name: "인상 저장하기" }));
    expect(await screen.findByText("참가자별 인상을 저장하는 중이에요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장 중…" }));
    expect(createImpressions).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("참가자별 인상을 저장했어요.")).not.toBeInTheDocument();

    await act(async () => response.resolve(receipt));
    const status = await screen.findByText("참가자별 인상을 저장했어요.");
    expect(status).toHaveFocus();
    expect(screen.queryByText("비공개 피드백을 제출했어요. 운영팀만 확인할 수 있어요.")).not.toBeInTheDocument();
    expect(screen.queryByText("다음 행동을 저장했어요.")).not.toBeInTheDocument();
  });

  it("shows retryable generic and 409 impressions failures without a success claim", async () => {
    const createImpressions = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(postMeetupProblem(409, "이미 저장된 인상이에요."))
      .mockResolvedValueOnce(receipt);
    const api = createApi({ listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("target", "서윤")] }), createImpressions });
    renderAuthenticated(api);

    await selectImpression();
    fireEvent.click(screen.getByRole("button", { name: "인상 저장하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("인상을 저장하지 못했어요. 다시 시도해 주세요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이미 저장된 인상이에요.");
    expect(screen.queryByText("참가자별 인상을 저장했어요.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(createImpressions).toHaveBeenCalledTimes(3));
    expect(createImpressions.mock.calls[1]).toEqual(createImpressions.mock.calls[0]);
    expect(await screen.findByText("참가자별 인상을 저장했어요.")).toBeInTheDocument();
  });

  it("validates next intent then sends the exact supported value after a 201 receipt", async () => {
    const response = deferred<typeof receipt>();
    const createNextIntent = vi.fn().mockReturnValue(response.promise);
    const api = createApi({ createNextIntent });
    renderAuthenticated(api);
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledWith("demo", { limit: 20 }, "access"));

    await waitFor(() => expect(screen.getByRole("button", { name: "다음 행동 저장하기" })).toBeDisabled());
    fireEvent.click(screen.getByRole("radio", { name: "같은 활동을 새로운 사람들과 하기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "다음 행동 저장하기" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "다음 행동 저장하기" }));
    await waitFor(() => expect(createNextIntent).toHaveBeenCalledWith("demo", { type: "SAME_ACTIVITY_NEW_PEOPLE" }, "access"));
    expect(screen.queryByText("다음 행동을 저장했어요.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장 중…" }));
    expect(createNextIntent).toHaveBeenCalledTimes(1);

    await act(async () => response.resolve(receipt));
    const status = await screen.findByText("다음 행동을 저장했어요.");
    expect(status).toHaveFocus();
  });

  it("exposes every next-intent enum and retries a generic failure with the same payload", async () => {
    const createNextIntent = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(receipt);
    const api = createApi({ createNextIntent });
    renderAuthenticated(api);
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledWith("demo", { limit: 20 }, "access"));

    expect(screen.getByRole("radio", { name: "같은 사람들과 다시 만나기" })).toHaveAttribute("value", "SAME_GROUP");
    expect(screen.getByRole("radio", { name: "같은 활동을 새로운 사람들과 하기" })).toHaveAttribute("value", "SAME_ACTIVITY_NEW_PEOPLE");
    expect(screen.getByRole("radio", { name: "다른 활동 해보기" })).toHaveAttribute("value", "DIFFERENT_ACTIVITY");
    fireEvent.click(screen.getByRole("radio", { name: "다른 활동 해보기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "다음 행동 저장하기" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "다음 행동 저장하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("다음 행동을 저장하지 못했어요. 다시 시도해 주세요.");
    expect(screen.queryByText("다음 행동을 저장했어요.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(createNextIntent).toHaveBeenCalledTimes(2));
    expect(createNextIntent.mock.calls[1]).toEqual(createNextIntent.mock.calls[0]);
    expect(await screen.findByText("다음 행동을 저장했어요.")).toBeInTheDocument();
  });

  it("keeps feedback, impressions, and next intent as independent mutations", async () => {
    const feedbackResponse = deferred<typeof receipt>();
    const api = createApi({
      createFeedback: vi.fn().mockReturnValue(feedbackResponse.promise),
      listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("target", "서윤")] }),
      createImpressions: vi.fn().mockResolvedValue(receipt),
      createNextIntent: vi.fn().mockResolvedValue(receipt),
    });
    renderAuthenticated(api);

    await fillScores();
    fireEvent.click(screen.getByRole("button", { name: "비공개로 제출하기" }));
    await selectImpression();
    fireEvent.click(screen.getByRole("button", { name: "인상 저장하기" }));
    expect(await screen.findByText("참가자별 인상을 저장했어요.")).toBeInTheDocument();
    expect(screen.queryByText("비공개 피드백을 제출했어요. 운영팀만 확인할 수 있어요.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "다른 활동 해보기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "다음 행동 저장하기" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "다음 행동 저장하기" }));
    expect(await screen.findByText("다음 행동을 저장했어요.")).toBeInTheDocument();
    expect(screen.getByText("피드백을 제출하는 중이에요.")).toBeInTheDocument();

    await act(async () => feedbackResponse.resolve(receipt));
    expect(await screen.findByText("비공개 피드백을 제출했어요. 운영팀만 확인할 수 있어요.")).toBeInTheDocument();
  });

  it.each([
    { mutation: "feedback" as const, outcome: "success" as const },
    { mutation: "feedback" as const, outcome: "error" as const },
    { mutation: "impressions" as const, outcome: "success" as const },
    { mutation: "impressions" as const, outcome: "error" as const },
    { mutation: "nextIntent" as const, outcome: "success" as const },
    { mutation: "nextIntent" as const, outcome: "error" as const },
  ])("ignores a stale route $outcome for $mutation", async ({ mutation, outcome }) => {
    const response = deferred<typeof receipt>();
    const { api, method } = createDeferredMutationApi(mutation, response);
    const view = renderAuthenticated(api);
    await submitMutation(mutation);
    await waitFor(() => expect(method).toHaveBeenCalledTimes(1));

    routeId = "next/with space";
    view.rerender(<AuthenticatedTestRoot api={api}><FeedbackPage /></AuthenticatedTestRoot>);
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(2));
    if (outcome === "success") {
      await act(async () => response.resolve(receipt));
      expect(screen.queryByText(mutationSuccessText(mutation))).not.toBeInTheDocument();
      return;
    }
    await act(async () => response.reject(new Error(`old ${mutation} route failure`)));
    expect(screen.queryByText(mutationErrorText(mutation))).not.toBeInTheDocument();
  });

  it.each([
    { mutation: "feedback" as const, outcome: "success" as const },
    { mutation: "feedback" as const, outcome: "error" as const },
    { mutation: "impressions" as const, outcome: "success" as const },
    { mutation: "impressions" as const, outcome: "error" as const },
    { mutation: "nextIntent" as const, outcome: "success" as const },
    { mutation: "nextIntent" as const, outcome: "error" as const },
  ])("ignores a stale account $outcome for $mutation", async ({ mutation, outcome }) => {
    const response = deferred<typeof receipt>();
    const { api, method } = createDeferredMutationApi(mutation, response);
    api.createSession = vi.fn(({ requestId }) => Promise.resolve({
      accessToken: requestId === anotherUser.id ? "access-b" : "access",
      refreshToken: "refresh",
      expiresIn: 900,
      user: requestId === anotherUser.id ? anotherUser : user,
    }));
    renderAuthenticated(api);
    await submitMutation(mutation);
    await waitFor(() => expect(method).toHaveBeenCalledTimes(1));

    await act(async () => getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }));
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(2));
    if (outcome === "success") {
      await act(async () => response.resolve(receipt));
      expect(screen.queryByText(mutationSuccessText(mutation))).not.toBeInTheDocument();
      return;
    }
    await act(async () => response.reject(new Error(`old ${mutation} account failure`)));
    expect(screen.queryByText(mutationErrorText(mutation))).not.toBeInTheDocument();
  });

  it.each([
    { mutation: "feedback" as const, outcome: "success" as const },
    { mutation: "impressions" as const, outcome: "success" as const },
    { mutation: "nextIntent" as const, outcome: "success" as const },
    { mutation: "feedback" as const, outcome: "error" as const },
    { mutation: "impressions" as const, outcome: "error" as const },
    { mutation: "nextIntent" as const, outcome: "error" as const },
  ])("ignores a prior session $outcome for $mutation after the same subject logs out and back in", async ({ mutation, outcome }) => {
    const response = deferred<typeof receipt>();
    const { api, method } = createDeferredMutationApi(mutation, response);
    api.createSession = vi.fn(() => Promise.resolve({
      accessToken: "access", refreshToken: "refresh", expiresIn: 900, user,
    }));
    renderAuthenticated(api);
    await submitMutation(mutation);
    await waitFor(() => expect(method).toHaveBeenCalledTimes(1));

    await act(async () => getLatestSession().logout());
    await screen.findByText("로그인 후 비공개 피드백을 제출할 수 있어요.");
    await act(async () => getLatestSession().createSession({ requestId: user.id, otp: "654321" }));
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(2));

    if (outcome === "success") {
      await act(async () => response.resolve(receipt));
      expect(screen.queryByText(mutationSuccessText(mutation))).not.toBeInTheDocument();
      return;
    }
    await act(async () => response.reject(new Error(`old ${mutation} session failure`)));
    expect(screen.queryByText(mutationErrorText(mutation))).not.toBeInTheDocument();
  });

  it("blocks offline feedback, impressions, and next-intent submissions and keeps the drafts", async () => {
    const api = createApi({ listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("target", "서윤")] }) });
    renderAuthenticated(api);
    await selectImpression();
    await waitFor(() => expect(screen.getByRole("radio", { name: "같은 사람들과 다시 만나기" })).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", { name: "같은 사람들과 다시 만나기" }));

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "비공개로 제출하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "인상 저장하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음 행동 저장하기" })).toBeDisabled();
    expect(api.createFeedback).not.toHaveBeenCalled();
    expect(api.createImpressions).not.toHaveBeenCalled();
    expect(api.createNextIntent).not.toHaveBeenCalled();

    act(() => setOnline(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "비공개로 제출하기" })).toBeEnabled());
    await waitFor(() => expect(screen.getByRole("button", { name: "인상 저장하기" })).toBeEnabled());
    await waitFor(() => expect(screen.getByRole("button", { name: "다음 행동 저장하기" })).toBeEnabled());
    expect(screen.getByRole("checkbox", { name: "친절하게 대했어요" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "같은 사람들과 다시 만나기" })).toBeChecked();
  });
});

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}
