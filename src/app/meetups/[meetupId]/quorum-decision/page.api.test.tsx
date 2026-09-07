import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError } from "@/lib/api/client";

import { actionMeetup, anotherUser, AuthenticatedTestRoot, createApi, deferred, getLatestSession, meetup, renderAuthenticated, user } from "../action-page-test-utils";
import QuorumDecisionPage from "./page";

let routeMeetupId = "demo";
vi.mock("next/navigation", () => ({ useParams: () => ({ meetupId: routeMeetupId }) }));

const quorumResult = { meetupId: "demo", state: "CONFIRMED" as const, quorumDecision: "PROCEED" as const, joinedCount: 2, decidedAt: "2026-09-07T10:00:00.000Z", version: 2, quorumStatus: "PROCEED" as const };

function trigger(decision: "PROCEED" | "CANCEL") {
  fireEvent.click(screen.getByRole("button", { name: decision === "PROCEED" ? "현재 인원으로 진행하기" : "인원 부족으로 취소하기" }));
}
function confirm(decision: "PROCEED" | "CANCEL") {
  fireEvent.click(screen.getByRole("button", { name: decision === "PROCEED" ? "진행하기" : "취소하기" }));
}
function problem(status: number, detail: string) {
  return new ApiProblemError(status, { type: "https://bungae.example/problem", title: "결정 실패", status, detail, instance: "/v1/meetups/demo/quorum-decision", code: "QUORUM_FAILED", traceId: "trace-1" });
}

describe("QuorumDecisionPage API behavior", () => {
  beforeEach(() => { routeMeetupId = "demo"; vi.restoreAllMocks(); });

  it("denies an unauthenticated direct URL without a mutation", () => {
    const api = createApi();
    render(<QuorumDecisionPage />);
    expect(screen.getByText("로그인한 뒤 진행 여부를 확인해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "현재 인원으로 진행하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "인원 부족으로 취소하기" })).toBeDisabled();
    expect(api.decideQuorum).not.toHaveBeenCalled();
  });

  it("denies an authenticated direct URL when QUORUM_DECISION is absent", async () => {
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(meetup) });
    renderAuthenticated(<QuorumDecisionPage />, api);
    expect(await screen.findByText("현재 이 모임의 진행 여부를 결정할 수 없어요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "현재 인원으로 진행하기" })).toBeDisabled();
    expect(api.decideQuorum).not.toHaveBeenCalled();
  });

  it("keeps confirmation local, sends no mutation before confirm, and restores dismiss focus", async () => {
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("QUORUM_DECISION")) });
    renderAuthenticated(<QuorumDecisionPage />, api);
    const triggerButton = await screen.findByRole("button", { name: "인원 부족으로 취소하기" });
    trigger("CANCEL");
    expect(screen.getByRole("dialog", { name: "모임을 취소할까요?" })).toBeInTheDocument();
    expect(api.decideQuorum).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(triggerButton).toHaveFocus());
  });

  it("sends PROCEED only after confirmation and waits for the response before success", async () => {
    const response = deferred<typeof quorumResult>();
    const decideQuorum = vi.fn().mockReturnValue(response.promise);
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("QUORUM_DECISION", 4)), decideQuorum });
    renderAuthenticated(<QuorumDecisionPage />, api);
    await screen.findByRole("button", { name: "현재 인원으로 진행하기" });
    trigger("PROCEED");
    expect(api.decideQuorum).not.toHaveBeenCalled();
    confirm("PROCEED");
    await waitFor(() => expect(decideQuorum).toHaveBeenCalledWith("demo", "PROCEED", 4, expect.any(String), "access"));
    expect(screen.queryByRole("heading", { name: "모임을 진행하기로 했어요" })).not.toBeInTheDocument();
    await act(async () => { response.resolve(quorumResult); });
    expect(await screen.findByRole("heading", { name: "모임을 진행하기로 했어요" })).toBeInTheDocument();
  });

  it("sends CANCEL payload after confirmation", async () => {
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("QUORUM_DECISION", 7)), decideQuorum: vi.fn().mockResolvedValue({ ...quorumResult, quorumDecision: "CANCEL", state: "CANCELLED", quorumStatus: "CANCEL" }) });
    renderAuthenticated(<QuorumDecisionPage />, api);
    await screen.findByRole("button", { name: "인원 부족으로 취소하기" });
    trigger("CANCEL");
    confirm("CANCEL");
    await waitFor(() => expect(api.decideQuorum).toHaveBeenCalledWith("demo", "CANCEL", 7, expect.any(String), "access"));
    expect(await screen.findByRole("heading", { name: "모임을 취소했어요" })).toBeInTheDocument();
  });

  it("deduplicates in-flight submit, surfaces generic and API errors, and rolls keys on decision edit", async () => {
    const response = deferred<typeof quorumResult>();
    const decideQuorum = vi.fn().mockReturnValueOnce(response.promise).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(problem(503, "결정을 처리하지 못했어요.")).mockResolvedValueOnce({ ...quorumResult, quorumDecision: "CANCEL", state: "CANCELLED", quorumStatus: "CANCEL" });
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("proceed-key").mockReturnValueOnce("cancel-key");
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("QUORUM_DECISION")), decideQuorum });
    renderAuthenticated(<QuorumDecisionPage />, api);
    await screen.findByRole("button", { name: "현재 인원으로 진행하기" });
    trigger("PROCEED"); confirm("PROCEED");
    await waitFor(() => expect(decideQuorum).toHaveBeenCalledTimes(1));
    trigger("PROCEED");
    expect(screen.getByRole("button", { name: "현재 인원으로 진행하기" })).toBeDisabled();
    await act(async () => { response.reject(new Error("offline")); });
    expect(await screen.findByText("진행 여부를 결정하지 못했어요. 다시 시도해 주세요.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    trigger("PROCEED"); confirm("PROCEED");
    await waitFor(() => expect(decideQuorum).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("진행 여부를 결정하지 못했어요. 다시 시도해 주세요.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    trigger("PROCEED"); confirm("PROCEED");
    expect(await screen.findByText("결정을 처리하지 못했어요.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    trigger("CANCEL"); confirm("CANCEL");
    expect(await screen.findByRole("heading", { name: "모임을 취소했어요" })).toBeInTheDocument();
    expect(decideQuorum.mock.calls.map((call) => call[3])).toEqual(["proceed-key", "proceed-key", "proceed-key", "cancel-key"]);
  });

  it("on 409 refreshes detail and retries the same semantic decision with fresh version and same key", async () => {
    const decideQuorum = vi.fn().mockRejectedValueOnce(problem(409, "이미 변경됐어요.")).mockResolvedValueOnce(quorumResult);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("retry-key");
    const getMeetup = vi.fn().mockResolvedValueOnce(actionMeetup("QUORUM_DECISION", 1)).mockResolvedValueOnce(actionMeetup("QUORUM_DECISION", 2));
    const api = createApi({ getMeetup, decideQuorum });
    renderAuthenticated(<QuorumDecisionPage />, api);
    await screen.findByRole("button", { name: "현재 인원으로 진행하기" });
    trigger("PROCEED"); confirm("PROCEED");
    expect(await screen.findByText("최신 모임 정보를 다시 불러왔어요. 내용을 확인한 뒤 다시 결정해 주세요.")).toBeInTheDocument();
    expect(getMeetup).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    trigger("PROCEED"); confirm("PROCEED");
    expect(await screen.findByRole("heading", { name: "모임을 진행하기로 했어요" })).toBeInTheDocument();
    expect(decideQuorum.mock.calls.map((call) => [call[2], call[3]])).toEqual([[1, "retry-key"], [2, "retry-key"]]);
  });

  it("ignores stale route and account completions", async () => {
    const routeResponse = deferred<typeof quorumResult>();
    const routeApi = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("QUORUM_DECISION")), decideQuorum: vi.fn().mockReturnValue(routeResponse.promise) });
    const view = renderAuthenticated(<QuorumDecisionPage />, routeApi);
    await screen.findByRole("button", { name: "현재 인원으로 진행하기" });
    trigger("PROCEED"); confirm("PROCEED");
    routeMeetupId = "replacement";
    view.rerender(<AuthenticatedTestRoot api={routeApi}><QuorumDecisionPage /></AuthenticatedTestRoot>);
    await act(async () => { routeResponse.resolve(quorumResult); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "모임을 진행하기로 했어요" })).not.toBeInTheDocument());
    view.unmount();

    routeMeetupId = "demo";
    const accountResponse = deferred<typeof quorumResult>();
    const accountApi = createApi({ createSession: vi.fn().mockResolvedValueOnce({ accessToken: "old", refreshToken: "old-refresh", expiresIn: 900, user }).mockResolvedValueOnce({ accessToken: "new", refreshToken: "new-refresh", expiresIn: 900, user: anotherUser }), getMeetup: vi.fn().mockResolvedValue(actionMeetup("QUORUM_DECISION")), decideQuorum: vi.fn().mockReturnValue(accountResponse.promise) });
    renderAuthenticated(<QuorumDecisionPage />, accountApi);
    await screen.findByRole("button", { name: "현재 인원으로 진행하기" });
    trigger("PROCEED"); confirm("PROCEED");
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }); });
    await act(async () => { accountResponse.resolve(quorumResult); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "모임을 진행하기로 했어요" })).not.toBeInTheDocument());
  });

  it("ignores a prior session's decision receipt after the same subject logs out and back in", async () => {
    const response = deferred<typeof quorumResult>();
    const api = createApi({
      createSession: vi.fn(() => Promise.resolve({
        accessToken: "access", refreshToken: "refresh", expiresIn: 900, user,
      })),
      getMeetup: vi.fn().mockResolvedValue(actionMeetup("QUORUM_DECISION")),
      decideQuorum: vi.fn().mockReturnValue(response.promise),
    });
    const view = renderAuthenticated(<QuorumDecisionPage />, api);
    await screen.findByRole("button", { name: "현재 인원으로 진행하기" });
    trigger("PROCEED"); confirm("PROCEED");

    await act(async () => {
      await getLatestSession().logout();
    });
    await screen.findByText("로그인한 뒤 진행 여부를 확인해 주세요.");
    await act(async () => {
      await getLatestSession().createSession({ requestId: user.id, otp: "654321" });
    });
    await screen.findByRole("button", { name: "현재 인원으로 진행하기" });

    await act(async () => { response.resolve(quorumResult); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "모임을 진행하기로 했어요" })).not.toBeInTheDocument());
    view.unmount();
  });

  it("keeps decision triggers disabled and sends no mutation while offline", async () => {
    const decideQuorum = vi.fn();
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("QUORUM_DECISION")), decideQuorum });
    renderAuthenticated(<QuorumDecisionPage />, api);
    await screen.findByRole("button", { name: "현재 인원으로 진행하기" });

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    const proceed = screen.getByRole("button", { name: "현재 인원으로 진행하기" });
    const cancel = screen.getByRole("button", { name: "인원 부족으로 취소하기" });
    expect(proceed).toBeDisabled();
    expect(cancel).toBeDisabled();
    fireEvent.click(proceed);
    expect(decideQuorum).not.toHaveBeenCalled();

    act(() => setOnline(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "현재 인원으로 진행하기" })).toBeEnabled());
    expect(decideQuorum).not.toHaveBeenCalled();
  });
});

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}
