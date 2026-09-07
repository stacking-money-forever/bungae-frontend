import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import {
  AuthSessionProvider,
  type AuthSessionContextValue,
  useAuthSession,
} from "@/lib/auth/auth-session-provider";
import WithdrawalPage from "./page";

let pathname = "/profile/withdrawal";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

const userA = {
  id: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  displayName: "민지",
  ageBand: "25_34" as const,
  interestCodes: ["walk"],
  homeAreaCode: "MAPO",
  adultVerified: true,
  identityVerified: true,
  version: 4,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const userB = { ...userA, id: "b7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", displayName: "서연" };

const scheduled = {
  id: "withdrawal-1",
  state: "SCHEDULED" as const,
  requestedAt: "2026-09-08T00:00:00.000Z",
  effectiveAt: "2026-09-15T00:00:00.000Z",
  cancelledAt: null,
  completedAt: null,
  version: 1,
};

function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn(),
    createSession: vi.fn().mockImplementation(({ requestId }) => Promise.resolve({ accessToken: requestId === userB.id ? "access-b" : "access-a", refreshToken: "refresh", expiresIn: 900, user: requestId === userB.id ? userB : userA })),
    refreshSession: vi.fn(),
    getMe: vi.fn(),
    updateMe: vi.fn(),
    getActivityPolicies: vi.fn(),
    createVerificationSession: vi.fn(),
    getWithdrawal: vi.fn().mockResolvedValue(null),
    scheduleWithdrawal: vi.fn(),
    cancelWithdrawal: vi.fn(),
    createNoShowAppeal: vi.fn(),
    listNoShowAppeals: vi.fn(),
    getNoShowAppeal: vi.fn(),
    listIncidents: vi.fn(),
    listMeetups: vi.fn(),
    getMeetup: vi.fn(),
    createMeetup: vi.fn(),
    joinMeetup: vi.fn(),
    leaveMeetup: vi.fn(),
    cancelMeetup: vi.fn(),
    decideQuorum: vi.fn(),
    checkInMeetup: vi.fn(),
    listMyMeetups: vi.fn(),
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    listMeetupMessages: vi.fn(),
    createMeetupMessage: vi.fn(),
    createReport: vi.fn(),
    createFeedback: vi.fn(),
    createImpressions: vi.fn(),
    createNextIntent: vi.fn(),
    listParticipants: vi.fn(),
    createConnectionIntent: vi.fn(),
    listConnections: vi.fn(),
    deleteConnection: vi.fn(),
    listBlocks: vi.fn(),
    createBlock: vi.fn(),
    deleteBlock: vi.fn(),
    searchPlaces: vi.fn(),
    deleteCurrentSession: vi.fn(),
    putPushDevice: vi.fn(),
    deletePushDevice: vi.fn(),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function AuthenticatedWithdrawal() {
  const { createSession } = useAuthSession();
  useEffect(() => {
    void createSession({ requestId: userA.id, otp: "123456" });
  }, [createSession]);
  return <WithdrawalPage />;
}

function renderAuthenticatedWithdrawal(api: BungaeApi) {
  return render(<AuthSessionProvider api={api}><AuthenticatedWithdrawal /></AuthSessionProvider>);
}

let latestSession: AuthSessionContextValue;

function SwitchableWithdrawal() {
  latestSession = useAuthSession();
  return <WithdrawalPage />;
}
function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}
afterEach(() => {
  pathname = "/profile/withdrawal";
  setOnline(true);
});


describe("WithdrawalPage", () => {
  it("blocks unauthenticated mutation controls", () => {
    render(<AuthSessionProvider><WithdrawalPage /></AuthSessionProvider>);

    expect(screen.getByRole("heading", { name: "로그인한 계정에서만 탈퇴를 예약할 수 있어요" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "계정 탈퇴 예약" })).not.toBeInTheDocument();
  });

  it("shows terminal server DTO timestamps without a cancellation control", async () => {
    const api = createApi({
      getWithdrawal: vi.fn().mockResolvedValue({ ...scheduled, state: "COMPLETED" as const, completedAt: "2026-09-16T00:00:00.000Z" }),
    });
    renderAuthenticatedWithdrawal(api);

    await screen.findByRole("heading", { name: "계정 탈퇴가 완료됐어요" });
    expect(screen.getByText(scheduled.requestedAt)).toBeInTheDocument();
    expect(screen.getByText(scheduled.effectiveAt)).toBeInTheDocument();
    expect(screen.getByText("2026-09-16T00:00:00.000Z")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "탈퇴 예약 취소" })).not.toBeInTheDocument();
  });

  it("shows a retryable withdrawal GET failure before rendering a no-schedule state", async () => {
    const api = createApi({
      getWithdrawal: vi.fn().mockRejectedValueOnce(new ApiProblemError(503, null)).mockResolvedValueOnce(null),
    });
    renderAuthenticatedWithdrawal(api);

    expect(await screen.findByRole("alert")).toHaveTextContent("탈퇴 예약 상태를 불러오지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    await screen.findByRole("heading", { name: "진행 중인 탈퇴 예약이 없어요" });
  });

  it("waits for POST 202 before replacing no-schedule state", async () => {
    const request = deferred<typeof scheduled>();
    const api = createApi({ scheduleWithdrawal: vi.fn().mockReturnValue(request.promise) });
    renderAuthenticatedWithdrawal(api);

    await screen.findByRole("heading", { name: "진행 중인 탈퇴 예약이 없어요" });
    fireEvent.click(screen.getByRole("button", { name: "계정 탈퇴 예약" }));
    fireEvent.click(screen.getByRole("button", { name: /^탈퇴 예약$/ }));
    expect(screen.getByText("진행 중인 탈퇴 예약이 없어요")).toBeInTheDocument();
    await waitFor(() => expect(api.scheduleWithdrawal).toHaveBeenCalledWith(expect.any(String), "access-a"));

    expect(api.deleteCurrentSession).not.toHaveBeenCalled();
    await act(async () => request.resolve(scheduled));
    expect(await screen.findByRole("heading", { name: "탈퇴가 예약되어 있어요" })).toBeInTheDocument();
    expect(api.deleteCurrentSession).not.toHaveBeenCalled();
    expect(screen.getByText(scheduled.effectiveAt)).toBeInTheDocument();
  });

  it("retries a failed schedule with its original idempotency key", async () => {
    const api = createApi({
      scheduleWithdrawal: vi.fn().mockRejectedValueOnce(new ApiProblemError(503, null)).mockResolvedValueOnce(scheduled),
    });
    renderAuthenticatedWithdrawal(api);

    await screen.findByRole("heading", { name: "진행 중인 탈퇴 예약이 없어요" });
    fireEvent.click(screen.getByRole("button", { name: "계정 탈퇴 예약" }));
    fireEvent.click(screen.getByRole("button", { name: /^탈퇴 예약$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("계정 탈퇴 예약을 완료하지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    fireEvent.click(screen.getByRole("button", { name: /^탈퇴 예약$/ }));

    await screen.findByRole("heading", { name: "탈퇴가 예약되어 있어요" });
    const calls = vi.mocked(api.scheduleWithdrawal).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toBe(calls[0][0]);
  });

  it("keeps the scheduled DTO until DELETE 204, then refetches no schedule", async () => {
    const cancellation = deferred<void>();
    const api = createApi({
      getWithdrawal: vi.fn().mockResolvedValueOnce(scheduled).mockResolvedValueOnce(null),
      cancelWithdrawal: vi.fn().mockReturnValue(cancellation.promise),
    });
    renderAuthenticatedWithdrawal(api);

    await screen.findByRole("heading", { name: "탈퇴가 예약되어 있어요" });
    fireEvent.click(screen.getByRole("button", { name: "탈퇴 예약 취소" }));
    fireEvent.click(screen.getByRole("button", { name: "예약 취소" }));
    expect(screen.getByText(scheduled.effectiveAt)).toBeInTheDocument();
    await waitFor(() => expect(api.cancelWithdrawal).toHaveBeenCalledWith(1, "access-a"));

    await act(async () => cancellation.resolve());
    expect(await screen.findByRole("heading", { name: "진행 중인 탈퇴 예약이 없어요" })).toBeInTheDocument();
    expect(api.getWithdrawal).toHaveBeenCalledTimes(2);
  });

  it("keeps a cancellation retry available after a generic error", async () => {
    const api = createApi({
      getWithdrawal: vi.fn().mockResolvedValueOnce(scheduled).mockResolvedValueOnce(null),
      cancelWithdrawal: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined),
    });
    renderAuthenticatedWithdrawal(api);

    await screen.findByRole("heading", { name: "탈퇴가 예약되어 있어요" });
    fireEvent.click(screen.getByRole("button", { name: "탈퇴 예약 취소" }));
    fireEvent.click(screen.getByRole("button", { name: "예약 취소" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("탈퇴 예약을 취소하지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    fireEvent.click(screen.getByRole("button", { name: "예약 취소" }));

    await waitFor(() => expect(api.cancelWithdrawal).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.cancelWithdrawal).mock.calls).toEqual([[1, "access-a"], [1, "access-a"]]);
  });

  it("refreshes version-conflicted cancellation state and retries with the fresh version", async () => {
    const api = createApi({
      getWithdrawal: vi.fn().mockResolvedValueOnce(scheduled).mockResolvedValueOnce({ ...scheduled, version: 2 }),
      cancelWithdrawal: vi.fn().mockRejectedValueOnce(new ApiProblemError(409, null)).mockResolvedValueOnce(undefined),
    });
    renderAuthenticatedWithdrawal(api);

    await screen.findByRole("heading", { name: "탈퇴가 예약되어 있어요" });
    fireEvent.click(screen.getByRole("button", { name: "탈퇴 예약 취소" }));
    fireEvent.click(screen.getByRole("button", { name: "예약 취소" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("최신 정보를 다시 불러왔어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    fireEvent.click(screen.getByRole("button", { name: "예약 취소" }));

    await waitFor(() => expect(api.cancelWithdrawal).toHaveBeenLastCalledWith(2, "access-a"));
  });

  it("restores focus to the cancellation trigger when the confirmation is dismissed", async () => {
    const api = createApi({ getWithdrawal: vi.fn().mockResolvedValue(scheduled) });
    renderAuthenticatedWithdrawal(api);

    const trigger = await screen.findByRole("button", { name: "탈퇴 예약 취소" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("discards stale route load results after the route identity changes", async () => {
    const firstLoad = deferred<typeof scheduled | null>();
    const api = createApi({ getWithdrawal: vi.fn().mockReturnValueOnce(firstLoad.promise).mockResolvedValueOnce(null) });
    const view = renderAuthenticatedWithdrawal(api);

    await waitFor(() => expect(api.getWithdrawal).toHaveBeenCalledTimes(1));
    pathname = "/profile/withdrawal/reopened";
    view.rerender(<AuthSessionProvider api={api}><AuthenticatedWithdrawal /></AuthSessionProvider>);
    await screen.findByRole("heading", { name: "진행 중인 탈퇴 예약이 없어요" });
    await act(async () => firstLoad.resolve(scheduled));

    expect(screen.queryByText(scheduled.effectiveAt)).not.toBeInTheDocument();
  });

  it("discards a stale account mutation result and resets its dialog and pending state", async () => {
    const request = deferred<typeof scheduled>();
    const api = createApi({ scheduleWithdrawal: vi.fn().mockReturnValue(request.promise) });
    render(<AuthSessionProvider api={api}><SwitchableWithdrawal /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: userA.id, otp: "123456" });
    });
    await screen.findByRole("heading", { name: "진행 중인 탈퇴 예약이 없어요" });
    fireEvent.click(screen.getByRole("button", { name: "계정 탈퇴 예약" }));
    fireEvent.click(screen.getByRole("button", { name: /^탈퇴 예약$/ }));
    await waitFor(() => expect(api.scheduleWithdrawal).toHaveBeenCalledTimes(1));

    await act(async () => {
      await latestSession.createSession({ requestId: userB.id, otp: "123456" });
    });
    await screen.findByRole("heading", { name: "진행 중인 탈퇴 예약이 없어요" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await act(async () => request.resolve(scheduled));
    expect(screen.queryByText(scheduled.effectiveAt)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계정 탈퇴 예약" })).toBeEnabled();
  });

  it("drops a stale reload after the same subject logs out and back in", async () => {
    const firstLoad = deferred<typeof scheduled | null>();
    const api = createApi({ getWithdrawal: vi.fn().mockReturnValueOnce(firstLoad.promise).mockResolvedValueOnce(null) });
    render(<AuthSessionProvider api={api}><SwitchableWithdrawal /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: userA.id, otp: "123456" });
    });
    await waitFor(() => expect(api.getWithdrawal).toHaveBeenCalledTimes(1));

    await act(async () => {
      await latestSession.logout();
    });
    await screen.findByRole("heading", { name: "로그인한 계정에서만 탈퇴를 예약할 수 있어요" });

    await act(async () => {
      await latestSession.createSession({ requestId: userA.id, otp: "654321" });
    });
    await screen.findByRole("heading", { name: "진행 중인 탈퇴 예약이 없어요" });
    expect(api.getWithdrawal).toHaveBeenCalledTimes(2);

    await act(async () => firstLoad.resolve(scheduled));
    expect(screen.queryByText(scheduled.effectiveAt)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계정 탈퇴 예약" })).toBeEnabled();
  });

  it("keeps schedule and cancel disabled offline with an honest notice", async () => {
    const api = createApi({ getWithdrawal: vi.fn().mockResolvedValue(scheduled) });
    renderAuthenticatedWithdrawal(api);

    await screen.findByRole("heading", { name: "탈퇴가 예약되어 있어요" });
    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "탈퇴 예약 취소" })).toBeDisabled();

    act(() => setOnline(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "탈퇴 예약 취소" })).toBeEnabled());
  });

  it("does not schedule offline and keeps the no-schedule state until a real response", async () => {
    const api = createApi();
    renderAuthenticatedWithdrawal(api);

    await screen.findByRole("heading", { name: "진행 중인 탈퇴 예약이 없어요" });
    act(() => setOnline(false));
    const scheduleTrigger = screen.getByRole("button", { name: "계정 탈퇴 예약" });
    expect(scheduleTrigger).toBeDisabled();

    act(() => setOnline(true));
    await waitFor(() => expect(scheduleTrigger).toBeEnabled());
    fireEvent.click(scheduleTrigger);
    const confirm = screen.getByRole("button", { name: "탈퇴 예약" });
    expect(screen.getByRole("dialog", { name: "계정 탈퇴를 예약할까요?" })).toBeInTheDocument();

    act(() => setOnline(false));
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(api.scheduleWithdrawal).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "계정 탈퇴를 예약할까요?" })).toBeInTheDocument();
    expect(screen.getByText("진행 중인 탈퇴 예약이 없어요", { exact: false })).toBeInTheDocument();
  });

  it("does not label an unknown server withdrawal state as completed", async () => {
    const unknown = { ...scheduled, state: "PROCESSING" as const };
    const api = createApi({ getWithdrawal: vi.fn().mockResolvedValue(unknown) });
    renderAuthenticatedWithdrawal(api);

    expect(await screen.findByRole("heading", { name: "탈퇴 예약 상태를 확인할 수 없어요" })).toBeInTheDocument();
    expect(screen.queryByText("계정 탈퇴가 완료됐어요")).not.toBeInTheDocument();
    expect(screen.getByText(scheduled.requestedAt)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "탈퇴 예약 취소" })).not.toBeInTheDocument();
  });
});
