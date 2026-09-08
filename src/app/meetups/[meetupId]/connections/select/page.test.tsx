import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import { AuthSessionProvider } from "@/lib/auth/auth-session-provider";
import type { Participant } from "@/lib/api/types";

import {
  anotherUser,
  AuthenticatedTestRoot,
  createApi,
  deferred,
  getLatestSession,
  user,
} from "../../action-page-test-utils";
import ConnectionSelectPage from "./page";

let meetupId = "demo";
vi.mock("next/navigation", () => ({ useParams: () => ({ meetupId }) }));

const checkedIn = (userId: string, displayName: string) => ({
  userId,
  displayName,
  state: "CHECKED_IN" as const,
  joinedAt: "2026-09-07T10:00:00Z",
});

function apiProblem(detail: string) {
  return new ApiProblemError(422, {
    type: "https://bungae.example/problems/invalid",
    title: "Invalid request",
    status: 422,
    detail,
    instance: "/v1/meetups/demo/connection-intents",
    code: "INVALID",
    traceId: "trace-1",
  });
}

function accountAwareApi(overrides: Partial<BungaeApi> = {}) {
  return createApi({
    createSession: vi.fn().mockImplementation(({ requestId }) => Promise.resolve({
      accessToken: `access-${requestId}`,
      refreshToken: `refresh-${requestId}`,
      expiresIn: 900,
      user: requestId === anotherUser.id ? anotherUser : user,
    })),
    ...overrides,
  });
}

async function switchToAnotherAccount() {
  await act(async () => {
    await getLatestSession().createSession({ requestId: anotherUser.id, otp: "123456" });
  });
}

beforeEach(() => {
  meetupId = "demo";
});

describe("ConnectionSelectPage", () => {
  it("requires authentication without issuing a participant request", async () => {
    const api = createApi();
    render(<AuthSessionProvider api={api}><ConnectionSelectPage /></AuthSessionProvider>);

    expect(await screen.findByRole("alert")).toHaveTextContent("로그인 후 참가자를 확인할 수 있어요.");
    expect(api.listParticipants).not.toHaveBeenCalled();
  });

  it("shows loading before the authenticated empty response", async () => {
    const participants = deferred<{ items: [] }>();
    const api = createApi({ listParticipants: vi.fn().mockReturnValue(participants.promise) });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    expect(await screen.findByRole("status")).toHaveTextContent("참가자를 불러오는 중이에요.");
    await act(async () => participants.resolve({ items: [] }));
    expect(await screen.findByRole("status")).toHaveTextContent("선택할 체크인 참가자가 없어요.");
  });

  it("retries both API-problem and generic initial-load errors", async () => {
    const api = createApi({
      listParticipants: vi.fn()
        .mockRejectedValueOnce(apiProblem("참가자 권한이 없어요."))
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue({ items: [] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    expect(await screen.findByRole("alert")).toHaveTextContent("참가자 권한이 없어요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("참가자를 불러오지 못했어요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("선택할 체크인 참가자가 없어요.")).toBeInTheDocument();
  });

  it("appends the cursor page once and deduplicates existing participants", async () => {
    const api = createApi({
      listParticipants: vi.fn()
        .mockResolvedValueOnce({ items: [checkedIn("one", "서윤")], nextCursor: "next" })
        .mockResolvedValueOnce({ items: [checkedIn("one", "서윤"), checkedIn("two", "하늘")] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    expect(await screen.findByText("서윤")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByText("하늘")).toBeInTheDocument();
    expect(screen.getAllByText("서윤")).toHaveLength(1);
    expect(api.listParticipants).toHaveBeenLastCalledWith("demo", { cursor: "next", limit: 20 }, "access");
  });

  it("retries an append failure with the preserved cursor", async () => {
    const api = createApi({
      listParticipants: vi.fn()
        .mockResolvedValueOnce({ items: [checkedIn("one", "서윤")], nextCursor: "next" })
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ items: [checkedIn("two", "하늘")] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    await screen.findByText("서윤");
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("참가자를 더 불러오지 못했어요.");
    fireEvent.click(screen.getByRole("button", { name: "더 보기 재시도" }));
    expect(await screen.findByText("하늘")).toBeInTheDocument();
    expect(api.listParticipants).toHaveBeenLastCalledWith("demo", { cursor: "next", limit: 20 }, "access");
  });

  it("shows only checked-in non-self participants", async () => {
    const api = createApi({
      listParticipants: vi.fn().mockResolvedValue({
        items: [
          checkedIn(user.id, user.displayName),
          checkedIn("checked", "서윤"),
          { ...checkedIn("joined", "숨김"), state: "JOINED" as const },
          { ...checkedIn("waitlisted", "대기"), state: "WAITLISTED" as const },
        ],
      }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    expect(await screen.findByText("서윤")).toBeInTheDocument();
    expect(screen.queryByText(user.displayName)).not.toBeInTheDocument();
    expect(screen.queryByText("숨김")).not.toBeInTheDocument();
    expect(screen.queryByText("대기")).not.toBeInTheDocument();
  });

  it("keeps seven unique selections and blocks an eighth target", async () => {
    const targets = Array.from({ length: 8 }, (_, index) => checkedIn(`target-${index + 1}`, `사람 ${index + 1}`));
    const api = createApi({
      listParticipants: vi.fn().mockResolvedValue({ items: targets }),
      createConnectionIntent: vi.fn().mockResolvedValue({ results: [] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    await screen.findByText("사람 1");
    fireEvent.click(screen.getByRole("button", { name: "사람 1" }));
    fireEvent.click(screen.getByRole("button", { name: "사람 1" }));
    for (let index = 1; index <= 7; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: `사람 ${index}` }));
    }
    fireEvent.click(screen.getByRole("button", { name: "사람 8" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 완료" }));

    await waitFor(() => expect(api.createConnectionIntent).toHaveBeenCalledWith(
      "demo",
      { targetUserIds: Array.from({ length: 7 }, (_, index) => `target-${index + 1}`) },
      "access",
    ));
    expect(screen.getByRole("button", { name: "사람 8" })).toHaveAttribute("aria-pressed", "false");
  });

  it("waits for the 201 result and suppresses duplicate in-flight submissions", async () => {
    const submitted = deferred<{ results: [{ targetUserId: string; state: "MATCHED"; connectionId: string }] }>();
    const api = createApi({
      listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("checked", "서윤")] }),
      createConnectionIntent: vi.fn().mockReturnValue(submitted.promise),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    await screen.findByText("서윤");
    fireEvent.click(screen.getByRole("button", { name: "서윤" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 완료" }));
    expect(await screen.findByRole("button", { name: "저장 중..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "저장 중..." }));
    expect(api.createConnectionIntent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status", { name: "상호 연결됐어요." })).not.toBeInTheDocument();

    await act(async () => submitted.resolve({ results: [{ targetUserId: "checked", state: "MATCHED", connectionId: "connection-1" }] }));
    expect(await screen.findByText("상호 연결됐어요.")).toBeInTheDocument();
    expect(screen.getByText("서로 연결됐어요")).toBeInTheDocument();
    expect(screen.queryByText(/connection-1/)).not.toBeInTheDocument();
    expect(screen.queryByText("MATCHED")).not.toBeInTheDocument();
  });

  it("keeps PENDING private and displays MATCHED only from the returned result", async () => {
    const api = createApi({
      listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("checked", "서윤")] }),
      createConnectionIntent: vi.fn().mockResolvedValue({ results: [{ targetUserId: "checked", state: "PENDING" }] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    await screen.findByText("서윤");
    fireEvent.click(screen.getByRole("button", { name: "서윤" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 완료" }));
    expect(await screen.findByText("선택을 저장했어요. 상대에게 공개되지 않아요.")).toBeInTheDocument();
    expect(screen.getByText("상대에게는 아직 보이지 않아요")).toBeInTheDocument();
    expect(screen.queryByText("PENDING")).not.toBeInTheDocument();
    expect(screen.queryByText("상호 연결됐어요.")).not.toBeInTheDocument();
  });

  it("retries API-problem and generic mutation errors with the exact selected targets", async () => {
    const api = createApi({
      listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("checked", "서윤")] }),
      createConnectionIntent: vi.fn()
        .mockRejectedValueOnce(apiProblem("선택 기간이 끝났어요."))
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue({ results: [{ targetUserId: "checked", state: "PENDING" }] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    await screen.findByText("서윤");
    fireEvent.click(screen.getByRole("button", { name: "서윤" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 완료" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("선택 기간이 끝났어요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("선택을 저장하지 못했어요. 다시 시도해 주세요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("상대에게는 아직 보이지 않아요")).toBeInTheDocument();
    expect(api.createConnectionIntent).toHaveBeenLastCalledWith("demo", { targetUserIds: ["checked"] }, "access");
  });

  it("ignores a stale list completion after a real meetup-route change", async () => {
    const first = deferred<{ items: Participant[] }>();
    const api = createApi({
      listParticipants: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce({ items: [checkedIn("second", "두번째 모임")] }),
    });
    const view = render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(1));

    meetupId = "other";
    view.rerender(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("두번째 모임")).toBeInTheDocument();
    await act(async () => first.resolve({ items: [checkedIn("first", "첫번째 모임")] }));
    expect(screen.queryByText("첫번째 모임")).not.toBeInTheDocument();
  });

  it("ignores a stale route mutation success", async () => {
    const submitted = deferred<{ results: [{ targetUserId: string; state: "MATCHED"; connectionId: string }] }>();
    const api = createApi({
      listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("target", "서윤")] }),
      createConnectionIntent: vi.fn().mockReturnValue(submitted.promise),
    });
    const view = render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    await screen.findByText("서윤");
    fireEvent.click(screen.getByRole("button", { name: "서윤" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 완료" }));
    meetupId = "other";
    view.rerender(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(2));
    await screen.findByText("서윤");
    await act(async () => submitted.resolve({ results: [{ targetUserId: "target", state: "MATCHED", connectionId: "old" }] }));
    expect(screen.queryByText("상호 연결됐어요.")).not.toBeInTheDocument();
  });

  it("ignores a stale route mutation error", async () => {
    const submitted = deferred<never>();
    const api = createApi({
      listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("target", "서윤")] }),
      createConnectionIntent: vi.fn().mockReturnValue(submitted.promise),
    });
    const view = render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    await screen.findByText("서윤");
    fireEvent.click(screen.getByRole("button", { name: "서윤" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 완료" }));
    meetupId = "other";
    view.rerender(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(2));
    await screen.findByText("서윤");
    await act(async () => submitted.reject(new Error("old failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignores a stale list completion after account A changes to B", async () => {
    const first = deferred<{ items: Participant[] }>();
    const api = accountAwareApi({
      listParticipants: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce({ items: [checkedIn("b-target", "B의 참가자")] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(1));

    await switchToAnotherAccount();
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("B의 참가자")).toBeInTheDocument();
    await act(async () => first.resolve({ items: [checkedIn("a-target", "A의 참가자")] }));
    expect(screen.queryByText("A의 참가자")).not.toBeInTheDocument();
  });

  it("ignores stale account mutation success and resets selection for B", async () => {
    const submitted = deferred<{ results: [{ targetUserId: string; state: "MATCHED"; connectionId: string }] }>();
    const api = accountAwareApi({
      listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("target", "서윤")] }),
      createConnectionIntent: vi.fn().mockReturnValue(submitted.promise),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    await screen.findByText("서윤");
    fireEvent.click(screen.getByRole("button", { name: "서윤" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 완료" }));
    await switchToAnotherAccount();
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "선택 완료" })).toBeDisabled());
    await act(async () => submitted.resolve({ results: [{ targetUserId: "target", state: "MATCHED", connectionId: "old" }] }));
    expect(screen.getByRole("button", { name: "선택 완료" })).toBeDisabled();
    expect(screen.queryByText("상호 연결됐어요.")).not.toBeInTheDocument();
  });

  it("ignores a stale account mutation error", async () => {
    const submitted = deferred<never>();
    const api = accountAwareApi({
      listParticipants: vi.fn().mockResolvedValue({ items: [checkedIn("target", "서윤")] }),
      createConnectionIntent: vi.fn().mockReturnValue(submitted.promise),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionSelectPage /></AuthenticatedTestRoot>);

    await screen.findByText("서윤");
    fireEvent.click(screen.getByRole("button", { name: "서윤" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 완료" }));
    await switchToAnotherAccount();
    await waitFor(() => expect(api.listParticipants).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "선택 완료" })).toBeDisabled());
    await act(async () => submitted.reject(new Error("old failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
