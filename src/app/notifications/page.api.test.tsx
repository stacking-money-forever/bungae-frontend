import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import type { Notification, UserProfile } from "@/lib/api/types";
import { AuthSessionProvider, type AuthSessionContextValue, useAuthSession } from "@/lib/auth/auth-session-provider";
import NotificationsPage from "./page";

const userA: UserProfile = { id: "user-a", displayName: "민지", ageBand: "25_34", interestCodes: [], homeAreaCode: "MAPO", adultVerified: true, identityVerified: true, version: 1, createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z" };
const userB: UserProfile = { ...userA, id: "user-b", displayName: "준호" };
const aUnread: Notification = { notificationId: "a-notice", type: "MEETUP_CANCELLED", createdAt: "2026-09-07T10:00:00Z", state: "UNREAD", version: 3 };
const bUnread: Notification = { notificationId: "b-notice", type: "CONNECTION_MATCHED", createdAt: "2026-09-07T11:00:00Z", state: "UNREAD", version: 1 };
const unknownUnread: Notification = { notificationId: "future-notice", type: "FUTURE_EVENT_TYPE", createdAt: "2026-09-07T12:00:00Z", state: "UNREAD", version: 1 };
const readA: Notification = { ...aUnread, state: "READ", version: 4, readAt: "2026-09-07T10:01:00Z" };

function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn(),
    createSession: vi.fn().mockImplementation(({ requestId }) => Promise.resolve({ accessToken: `access-${requestId}`, refreshToken: `refresh-${requestId}`, expiresIn: 900, user: requestId === userB.id ? userB : userA })),
    refreshSession: vi.fn(),
    getMe: vi.fn(),
    updateMe: vi.fn(),
    getActivityPolicies: vi.fn(),
    createVerificationSession: vi.fn(),
    listMeetups: vi.fn(),
    listMyMeetups: vi.fn(),
    getMeetup: vi.fn(),
    createMeetup: vi.fn(),
    joinMeetup: vi.fn(),
    leaveMeetup: vi.fn(),
    cancelMeetup: vi.fn(),
    decideQuorum: vi.fn(),
    checkInMeetup: vi.fn(),
    listNotifications: vi.fn().mockResolvedValue({ items: [aUnread] }),
    markNotificationRead: vi.fn().mockResolvedValue(readA),
    markAllNotificationsRead: vi.fn().mockResolvedValue({ updatedCount: 1, readAt: "2026-09-07T10:01:00Z" }),
    searchPlaces: vi.fn(),
    deleteCurrentSession: vi.fn().mockResolvedValue({ ok: true, attempted: true }),
    putPushDevice: vi.fn(),
    deletePushDevice: vi.fn(),
    listMeetupMessages: vi.fn(),
    createMeetupMessage: vi.fn(),
    createReport: vi.fn(),
    createFeedback: vi.fn(),
    listParticipants: vi.fn(),
    createConnectionIntent: vi.fn(),
    listConnections: vi.fn(),
    deleteConnection: vi.fn(),
    listBlocks: vi.fn(),
    createBlock: vi.fn(),
    deleteBlock: vi.fn(),
    createImpressions: vi.fn(),
    createNextIntent: vi.fn(),
    getWithdrawal: vi.fn(),
    scheduleWithdrawal: vi.fn(),
    cancelWithdrawal: vi.fn(),
    createNoShowAppeal: vi.fn(),
    listNoShowAppeals: vi.fn(),
    getNoShowAppeal: vi.fn(),
    listIncidents: vi.fn(),
    ...overrides,
  };
}

let latestSession: AuthSessionContextValue;

function SwitchablePage() {
  latestSession = useAuthSession();
  return <><button type="button" onClick={() => void latestSession.createSession({ requestId: userA.id, otp: "123456" })}>A 계정으로 전환</button><button type="button" onClick={() => void latestSession.createSession({ requestId: userB.id, otp: "654321" })}>B 계정으로 전환</button><NotificationsPage /></>;
}

function SessionPage() {
  const { createSession } = useAuthSession();
  useEffect(() => { void createSession({ requestId: userA.id, otp: "123456" }); }, [createSession]);
  return <NotificationsPage />;
}

function renderAuthenticated(api: BungaeApi) {
  return render(<AuthSessionProvider api={api}><SessionPage /></AuthSessionProvider>);
}

function renderSwitchable(api: BungaeApi) {
  return render(<AuthSessionProvider api={api}><SwitchablePage /></AuthSessionProvider>);
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: online });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
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

beforeEach(() => {
  setOnline(true);
});

describe("NotificationsPage API behavior", () => {
  it("does not show fixture activity while unauthenticated and keeps push settings", () => {
    render(<NotificationsPage />);
    expect(screen.getByText("로그인한 뒤 알림을 확인해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "알림 설정" })).toBeInTheDocument();
    expect(screen.queryByText(/모임 취소|서로 연결됨|알 수 없는 유형/)).not.toBeInTheDocument();
  });

  it("renders the authenticated empty state", async () => {
    renderAuthenticated(createApi({ listNotifications: vi.fn().mockResolvedValue({ items: [] }) }));
    expect(await screen.findByText("표시할 알림이 없어요.")).toBeInTheDocument();
  });

  it("maps known type tokens to local labels and never echoes raw tokens", async () => {
    renderAuthenticated(createApi());
    expect(await screen.findByText("모임이 취소됐어요")).toBeInTheDocument();
    expect(screen.queryByText(/MEETUP_CANCELLED|알림 유형/)).not.toBeInTheDocument();
  });

  it("renders unknown types with a safe phrase and no destination link", async () => {
    renderAuthenticated(createApi({ listNotifications: vi.fn().mockResolvedValue({ items: [unknownUnread] }) }));
    expect(await screen.findByText("알 수 없는 유형의 알림이에요")).toBeInTheDocument();
    expect(screen.queryByText(/FUTURE_EVENT_TYPE/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /FUTURE_EVENT_TYPE|알 수 없는 유형/ })).not.toBeInTheDocument();
  });

  it("commits B before ignoring A's late list response after a real account switch", async () => {
    const aList = Promise.withResolvers<{ items: Notification[] }>();
    const bList = Promise.withResolvers<{ items: Notification[] }>();
    const listNotifications = vi.fn().mockImplementation((_input, accessToken) => accessToken === `access-${userA.id}` ? aList.promise : bList.promise);
    renderSwitchable(createApi({ listNotifications }));

    await act(async () => { await latestSession.createSession({ requestId: userA.id, otp: "123456" }); });
    await waitFor(() => expect(listNotifications).toHaveBeenCalledWith({ cursor: undefined, limit: 20 }, `access-${userA.id}`));
    fireEvent.click(screen.getByRole("button", { name: "B 계정으로 전환" }));
    await waitFor(() => expect(listNotifications).toHaveBeenCalledWith({ cursor: undefined, limit: 20 }, `access-${userB.id}`));
    await act(async () => { bList.resolve({ items: [bUnread] }); });
    expect(await screen.findByText("상호 연결됐어요")).toBeInTheDocument();
    await act(async () => { aList.resolve({ items: [aUnread] }); });
    expect(screen.queryByText("모임이 취소됐어요")).not.toBeInTheDocument();
    expect(screen.getByText("상호 연결됐어요")).toBeInTheDocument();
  });

  it("drops a stale list after the same subject logs out and back in", async () => {
    const firstLoad = deferred<{ items: Notification[] }>();
    const listNotifications = vi.fn().mockReturnValueOnce(firstLoad.promise).mockResolvedValue({ items: [bUnread] });
    renderSwitchable(createApi({ listNotifications }));

    await act(async () => { await latestSession.createSession({ requestId: userA.id, otp: "123456" }); });
    await waitFor(() => expect(listNotifications).toHaveBeenCalledTimes(1));

    await act(async () => { await latestSession.logout(); });
    expect(screen.getByText("로그인한 뒤 알림을 확인해 주세요.")).toBeInTheDocument();

    await act(async () => { await latestSession.createSession({ requestId: userA.id, otp: "654321" }); });
    expect(await screen.findByText("상호 연결됐어요")).toBeInTheDocument();
    expect(listNotifications).toHaveBeenCalledTimes(2);

    await act(async () => { firstLoad.resolve({ items: [aUnread] }); });
    expect(screen.queryByText("모임이 취소됐어요")).not.toBeInTheDocument();
    expect(screen.getByText("상호 연결됐어요")).toBeInTheDocument();
  });

  it("ignores A's late single-read completion after B commits", async () => {
    const pendingRead = Promise.withResolvers<Notification>();
    const listNotifications = vi.fn().mockImplementation((_input, accessToken) => Promise.resolve({ items: accessToken === `access-${userA.id}` ? [aUnread] : [bUnread] }));
    renderSwitchable(createApi({ listNotifications, markNotificationRead: vi.fn().mockReturnValue(pendingRead.promise) }));

    await act(async () => { await latestSession.createSession({ requestId: userA.id, otp: "123456" }); });
    fireEvent.click(await screen.findByRole("button", { name: /읽음으로 표시/ }));
    await act(async () => { await latestSession.createSession({ requestId: userB.id, otp: "654321" }); });
    expect(await screen.findByText("상호 연결됐어요")).toBeInTheDocument();
    await act(async () => { pendingRead.resolve(readA); });
    expect(screen.getByText("상호 연결됐어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "모든 알림 읽기" })).toBeEnabled();
    expect(screen.queryByText("알림을 읽음으로 표시하지 못했어요.")).not.toBeInTheDocument();
  });

  it("ignores A's late read-all completion after B commits", async () => {
    const pendingAll = Promise.withResolvers<{ updatedCount: number; readAt: string }>();
    const listNotifications = vi.fn().mockImplementation((_input, accessToken) => Promise.resolve({ items: accessToken === `access-${userA.id}` ? [aUnread] : [bUnread] }));
    renderSwitchable(createApi({ listNotifications, markAllNotificationsRead: vi.fn().mockReturnValue(pendingAll.promise) }));

    await act(async () => { await latestSession.createSession({ requestId: userA.id, otp: "123456" }); });
    fireEvent.click(await screen.findByRole("button", { name: "모든 알림 읽기" }));
    await act(async () => { await latestSession.createSession({ requestId: userB.id, otp: "654321" }); });
    expect(await screen.findByText("상호 연결됐어요")).toBeInTheDocument();
    await act(async () => { pendingAll.resolve({ updatedCount: 1, readAt: "2026-09-07T10:01:00Z" }); });
    expect(screen.getByText("상호 연결됐어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "모든 알림 읽기" })).toBeEnabled();
    expect(screen.queryByText("모든 알림을 읽음으로 표시하지 못했어요.")).not.toBeInTheDocument();
  });

  it("keeps unread state and permits retry after a non-409 single-read error", async () => {
    const markNotificationRead = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(readA);
    renderAuthenticated(createApi({ markNotificationRead }));
    const control = await screen.findByRole("button", { name: /읽음으로 표시/ });
    fireEvent.click(control);
    expect(await screen.findByText("알림을 읽음으로 표시하지 못했어요.")).toBeInTheDocument();
    expect(screen.getByText("읽지 않음")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /읽음으로 표시/ }));
    expect(await screen.findByText("읽음")).toBeInTheDocument();
    expect(markNotificationRead).toHaveBeenCalledTimes(2);
  });

  it("refetches after a 409 read conflict and prevents duplicate submit", async () => {
    const listNotifications = vi.fn().mockResolvedValueOnce({ items: [aUnread] }).mockResolvedValueOnce({ items: [readA] });
    const markNotificationRead = vi.fn().mockRejectedValue(new ApiProblemError(409, null));
    renderAuthenticated(createApi({ listNotifications, markNotificationRead }));
    const control = await screen.findByRole("button", { name: /읽음으로 표시/ });
    fireEvent.click(control);
    fireEvent.click(control);
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("알림을 읽음으로 표시하지 못했어요.")).toBeInTheDocument();
    await waitFor(() => expect(listNotifications).toHaveBeenCalledTimes(2));
  });

  it("keeps unread state, blocks duplicates, and permits retry after a read-all error", async () => {
    const pendingError = Promise.withResolvers<{ updatedCount: number; readAt: string }>();
    const markAllNotificationsRead = vi.fn().mockReturnValueOnce(pendingError.promise).mockResolvedValueOnce({ updatedCount: 1, readAt: "2026-09-07T10:01:00Z" });
    const listNotifications = vi.fn().mockResolvedValueOnce({ items: [aUnread] }).mockResolvedValueOnce({ items: [readA] });
    renderAuthenticated(createApi({ listNotifications, markAllNotificationsRead }));
    await screen.findByText("모임이 취소됐어요");
    const control = await screen.findByRole("button", { name: "모든 알림 읽기" });
    expect(control).toBeEnabled();
    fireEvent.click(control);
    fireEvent.click(control);
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1));
    await act(async () => { pendingError.reject(new Error("offline")); });
    expect(await screen.findByText("모든 알림을 읽음으로 표시하지 못했어요.")).toBeInTheDocument();
    expect(screen.getByText("읽지 않음")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "모든 알림 읽기" }));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("읽음")).toBeInTheDocument();
  });

  it("surfaces an explicit append error with a retry that keeps the list", async () => {
    const listNotifications = vi.fn().mockResolvedValueOnce({ items: [aUnread], nextCursor: "next/value" }).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [bUnread] });
    renderAuthenticated(createApi({ listNotifications }));
    expect(await screen.findByText("모임이 취소됐어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "알림 더 보기" }));
    expect(await screen.findByText("알림을 불러오지 못했어요.")).toBeInTheDocument();
    expect(screen.getByText("모임이 취소됐어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("상호 연결됐어요")).toBeInTheDocument();
    expect(screen.queryByText("알림을 불러오지 못했어요.")).not.toBeInTheDocument();
    expect(listNotifications).toHaveBeenLastCalledWith({ cursor: "next/value", limit: 20 }, `access-${userA.id}`);
  });

  it("disables read controls offline with a hint and re-enables them after reconnect", async () => {
    const listNotifications = vi.fn().mockResolvedValue({ items: [aUnread] });
    const markNotificationRead = vi.fn().mockResolvedValue(readA);
    const markAllNotificationsRead = vi.fn().mockResolvedValue({ updatedCount: 1, readAt: "2026-09-07T10:01:00Z" });
    renderAuthenticated(createApi({ listNotifications, markNotificationRead, markAllNotificationsRead }));
    await screen.findByText("모임이 취소됐어요");

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "모든 알림 읽기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /읽음으로 표시/ })).toBeDisabled();
    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(markAllNotificationsRead).not.toHaveBeenCalled();

    act(() => setOnline(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "모든 알림 읽기" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /읽음으로 표시/ }));
    expect(await screen.findByText("읽음")).toBeInTheDocument();
    expect(markNotificationRead).toHaveBeenCalledWith("a-notice", 3, `access-${userA.id}`);
  });
});
