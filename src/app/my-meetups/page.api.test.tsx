import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import type { UserProfile } from "@/lib/api/types";
import { AuthSessionProvider, type AuthSessionContextValue, useAuthSession } from "@/lib/auth/auth-session-provider";
import MyMeetupsPage from "./page";

const userA: UserProfile = { id: "user-a", displayName: "민지", ageBand: "25_34", interestCodes: [], homeAreaCode: "MAPO", adultVerified: true, identityVerified: true, version: 1, createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z" };
const userB: UserProfile = { ...userA, id: "user-b", displayName: "준호" };
const aMeetup = { id: "id/with space", title: "A 서버 모임", state: "CONFIRMED" as const, relation: "PARTICIPANT", startsAt: "2026-09-07T10:00:00Z" };
const bMeetup = { id: "b-done", title: "B 완료 모임", state: "COMPLETED" as const, relation: "HOST", startsAt: "2026-09-06T10:00:00Z" };
const unknownStateMeetup = { id: "c-unknown", title: "C 미지원 상태 모임", state: "SOMETHING_ELSE" as unknown as "OPEN", relation: "WAITLIST", startsAt: "2026-09-07T10:00:00Z" };
const malformedMeetup = { id: "d-bad-date", title: "D 날짜 깨진 모임", state: "OPEN" as const, relation: "", startsAt: "not-a-date" };

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
    listMyMeetups: vi.fn().mockResolvedValue({ items: [aMeetup, bMeetup] }),
    getMeetup: vi.fn(),
    createMeetup: vi.fn(),
    joinMeetup: vi.fn(),
    leaveMeetup: vi.fn(),
    cancelMeetup: vi.fn(),
    decideQuorum: vi.fn(),
    checkInMeetup: vi.fn(),
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
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
  return <><button type="button" onClick={() => void latestSession.createSession({ requestId: userA.id, otp: "123456" })}>A 계정으로 전환</button><button type="button" onClick={() => void latestSession.createSession({ requestId: userB.id, otp: "654321" })}>B 계정으로 전환</button><MyMeetupsPage /></>;
}

function SessionPage() {
  const { createSession } = useAuthSession();
  useEffect(() => { void createSession({ requestId: userA.id, otp: "123456" }); }, [createSession]);
  return <MyMeetupsPage />;
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

describe("MyMeetupsPage API behavior", () => {
  it("does not show fixture content while unauthenticated", () => {
    render(<MyMeetupsPage />);
    expect(screen.getByText("로그인한 뒤 내 모임을 확인해 주세요.")).toBeInTheDocument();
    expect(screen.queryByText("A 서버 모임")).not.toBeInTheDocument();
  });

  it("renders only DTO fields, groups server state, and encodes routes", async () => {
    renderAuthenticated(createApi());
    expect(await screen.findByText("A 서버 모임")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /A 서버 모임/ })).toHaveAttribute("href", "/meetups/id%2Fwith%20space");
    expect(screen.getByRole("heading", { name: "진행 중" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "완료 및 취소" })).toBeInTheDocument();
    expect(screen.queryByText(/정원|장소|현재 [0-9]+명/)).not.toBeInTheDocument();
  });

  it("renders honest labels for known relations and states", async () => {
    renderAuthenticated(createApi());
    expect(await screen.findByText("확정 · 참여 중")).toBeInTheDocument();
    expect(screen.getByText("완료 · 내가 만든 모임")).toBeInTheDocument();
  });

  it("renders unknown DTO state/relation/date as unknown instead of inventing them", async () => {
    renderAuthenticated(createApi({ listMyMeetups: vi.fn().mockResolvedValue({ items: [unknownStateMeetup, malformedMeetup] }) }));
    expect(await screen.findByText("상태를 확인할 수 없어요 · WAITLIST · 알 수 없는 관계")).toBeInTheDocument();
    expect(screen.getByText("모집 중 · 관계 정보 없음")).toBeInTheDocument();
    expect(screen.getByText("시작 일시를 확인할 수 없어요")).toBeInTheDocument();
    expect(screen.queryByText(/SOMETHING_ELSE|not-a-date/)).not.toBeInTheDocument();
  });

  it("renders the authenticated empty state", async () => {
    renderAuthenticated(createApi({ listMyMeetups: vi.fn().mockResolvedValue({ items: [] }) }));
    expect(await screen.findByText("표시할 내 모임이 없어요.")).toBeInTheDocument();
  });

  it("retries an initial failure", async () => {
    const listMyMeetups = vi.fn().mockRejectedValueOnce(new ApiProblemError(503, null)).mockResolvedValueOnce({ items: [aMeetup] });
    renderAuthenticated(createApi({ listMyMeetups }));
    expect(await screen.findByText("내 모임을 불러오지 못했어요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("A 서버 모임")).toBeInTheDocument();
  });

  it("keeps loaded items and the next-cursor retry control after an append failure", async () => {
    const listMyMeetups = vi.fn().mockResolvedValueOnce({ items: [aMeetup], nextCursor: "next/value" }).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [bMeetup] });
    renderAuthenticated(createApi({ listMyMeetups }));
    expect(await screen.findByText("A 서버 모임")).toBeInTheDocument();
    const more = screen.getByRole("button", { name: "모임 더 보기" });
    fireEvent.click(more);
    await waitFor(() => expect(listMyMeetups).toHaveBeenCalledTimes(2));
    expect(screen.getByText("A 서버 모임")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "모임 더 보기" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "모임 더 보기" }));
    expect(await screen.findByText("B 완료 모임")).toBeInTheDocument();
    expect(listMyMeetups).toHaveBeenLastCalledWith({ relation: "ALL", cursor: "next/value", limit: 20 }, `access-${userA.id}`);
  });

  it("surfaces an explicit append error with a retry that keeps the list", async () => {
    const listMyMeetups = vi.fn().mockResolvedValueOnce({ items: [aMeetup], nextCursor: "next/value" }).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [bMeetup] });
    renderAuthenticated(createApi({ listMyMeetups }));
    expect(await screen.findByText("A 서버 모임")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "모임 더 보기" }));
    expect(await screen.findByText("내 모임을 불러오지 못했어요.")).toBeInTheDocument();
    expect(screen.getByText("A 서버 모임")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("B 완료 모임")).toBeInTheDocument();
    expect(screen.queryByText("내 모임을 불러오지 못했어요.")).not.toBeInTheDocument();
    expect(listMyMeetups).toHaveBeenLastCalledWith({ relation: "ALL", cursor: "next/value", limit: 20 }, `access-${userA.id}`);
  });

  it("commits B before ignoring A's late list response after a real account switch", async () => {
    const aList = Promise.withResolvers<{ items: typeof aMeetup[] }>();
    const bList = Promise.withResolvers<{ items: typeof bMeetup[] }>();
    const listMyMeetups = vi.fn().mockImplementation((_input, accessToken) => accessToken === `access-${userA.id}` ? aList.promise : bList.promise);
    renderSwitchable(createApi({ listMyMeetups }));

    await act(async () => { await latestSession.createSession({ requestId: userA.id, otp: "123456" }); });
    await waitFor(() => expect(listMyMeetups).toHaveBeenCalledWith({ relation: "ALL", cursor: undefined, limit: 20 }, `access-${userA.id}`));
    fireEvent.click(screen.getByRole("button", { name: "B 계정으로 전환" }));
    await waitFor(() => expect(listMyMeetups).toHaveBeenCalledWith({ relation: "ALL", cursor: undefined, limit: 20 }, `access-${userB.id}`));
    await act(async () => { bList.resolve({ items: [bMeetup] }); });
    expect(await screen.findByText("B 완료 모임")).toBeInTheDocument();
    await act(async () => { aList.resolve({ items: [aMeetup] }); });
    expect(screen.queryByText("A 서버 모임")).not.toBeInTheDocument();
    expect(screen.getByText("B 완료 모임")).toBeInTheDocument();
  });

  it("drops a stale list after the same subject logs out and back in", async () => {
    const firstLoad = deferred<{ items: typeof aMeetup[] }>();
    const listMyMeetups = vi.fn().mockReturnValueOnce(firstLoad.promise).mockResolvedValue({ items: [bMeetup] });
    renderSwitchable(createApi({ listMyMeetups }));

    await act(async () => { await latestSession.createSession({ requestId: userA.id, otp: "123456" }); });
    await waitFor(() => expect(listMyMeetups).toHaveBeenCalledTimes(1));

    await act(async () => { await latestSession.logout(); });
    expect(screen.getByText("로그인한 뒤 내 모임을 확인해 주세요.")).toBeInTheDocument();

    await act(async () => { await latestSession.createSession({ requestId: userA.id, otp: "654321" }); });
    expect(await screen.findByText("B 완료 모임")).toBeInTheDocument();
    expect(listMyMeetups).toHaveBeenCalledTimes(2);

    await act(async () => { firstLoad.resolve({ items: [aMeetup] }); });
    expect(screen.queryByText("A 서버 모임")).not.toBeInTheDocument();
    expect(screen.getByText("B 완료 모임")).toBeInTheDocument();
  });

  it("shows a polite offline hint while disconnected and still renders the last committed list", async () => {
    const listMyMeetups = vi.fn().mockResolvedValue({ items: [aMeetup] });
    renderAuthenticated(createApi({ listMyMeetups }));
    expect(await screen.findByText("A 서버 모임")).toBeInTheDocument();
    expect(screen.queryByText("인터넷 연결이 끊겼어요")).not.toBeInTheDocument();

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    expect(screen.getByText("A 서버 모임")).toBeInTheDocument();
    expect(listMyMeetups).toHaveBeenCalledTimes(1);

    act(() => setOnline(true));
    expect(screen.queryByText("인터넷 연결이 끊겼어요")).not.toBeInTheDocument();
    expect(listMyMeetups).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the page heading when the authenticated view loads", async () => {
    renderAuthenticated(createApi());
    const heading = await screen.findByRole("heading", { name: "내 모임" });
    expect(await screen.findByText("A 서버 모임")).toBeInTheDocument();
    expect(heading).toHaveFocus();
  });
});
