import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import type { BungaeApi } from "@/lib/api/client";
import type { Meetup } from "@/lib/api/types";
import { AuthSessionProvider, useAuthSession } from "@/lib/auth/auth-session-provider";

import {
  AuthenticatedHomeSurface,
  defaultHomeFilters,
  homeFiltersToMeetupQuery,
  type HomeFilters,
} from "./home-surface";

const user = {
  id: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  displayName: "민지",
  ageBand: "25_34" as const,
  interestCodes: ["WALK"],
  homeAreaCode: "MAPO",
  adultVerified: true,
  identityVerified: true,
  version: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const meetup: Meetup = {
  id: "b7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  activityCode: "WALK",
  title: "서버 한강 산책",
  startsAt: "2026-09-07T09:30:00.000Z",
  endsAt: "2026-09-07T11:00:00.000Z",
  minimumParticipants: 2,
  capacity: 4,
  venue: { name: "공개 장소", latitude: 37.5, longitude: 126.9, address: "비공개 주소" },
  cost: 0,
  alcoholPolicy: "NOT_ALLOWED",
  state: "OPEN",
  joinedCount: 1,
  version: 1,
  allowedActions: ["JOIN"],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  joinDeadline: "2026-09-07T09:30:00.000Z",
  quorumStatus: "PENDING",
};

const replacementUser = {
  ...user,
  id: "c7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  displayName: "서연",
};

function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn(),
    createSession: vi.fn().mockResolvedValue({ accessToken: "access", refreshToken: "refresh", expiresIn: 900, user }),
    refreshSession: vi.fn(),
    getMe: vi.fn(),
    updateMe: vi.fn(),
    getActivityPolicies: vi.fn(),
    createVerificationSession: vi.fn(),
    listMeetups: vi.fn().mockResolvedValue({ items: [meetup] }),
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
    createReport: vi.fn(), createFeedback: vi.fn(), listParticipants: vi.fn(), createConnectionIntent: vi.fn(), listConnections: vi.fn(), deleteConnection: vi.fn(), listBlocks: vi.fn(), createBlock: vi.fn(), deleteBlock: vi.fn(),
    createImpressions: vi.fn(), createNextIntent: vi.fn(),
    getWithdrawal: vi.fn(),
    scheduleWithdrawal: vi.fn(),
    cancelWithdrawal: vi.fn(),
    createNoShowAppeal: vi.fn(),
    listNoShowAppeals: vi.fn(),
    getNoShowAppeal: vi.fn(),
    listIncidents: vi.fn(),
    searchPlaces: vi.fn(),
    deleteCurrentSession: vi.fn(),
    putPushDevice: vi.fn(),
    deletePushDevice: vi.fn(),
    ...overrides,
  };
}

function SignedInDiscovery({ filters = defaultHomeFilters }: { filters?: HomeFilters }) {
  const { createSession } = useAuthSession();
  useEffect(() => {
    void createSession({ requestId: user.id, otp: "123456" });
  }, [createSession]);
  return <AuthenticatedHomeSurface filters={filters} />;
}

function renderDiscovery(api: BungaeApi) {
  return render(<AuthSessionProvider api={api}><SignedInDiscovery /></AuthSessionProvider>);
}

let latestSession: ReturnType<typeof useAuthSession>;

function SwitchableDiscovery() {
  latestSession = useAuthSession();
  return <AuthenticatedHomeSurface filters={defaultHomeFilters} />;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("authenticated discovery API", () => {
  it("maps current region, activity, time, cost, alcohol, and joinable filters into the v1 query", () => {
    const query = homeFiltersToMeetupQuery(
      { ...defaultHomeFilters, activity: "산책", time: "오늘 저녁", distance: "5km 이내", costAlcohol: "무료 · 음주 없음", availableOnly: true },
      new Date("2026-09-07T00:00:00.000Z"),
    );

    expect(query).toMatchObject({ activityCode: "WALK", latitude: 37.5562, longitude: 126.9019, radiusMeters: 5000, maxCost: 0, alcoholPolicy: "NOT_ALLOWED", joinableOnly: true });
    expect(query.startsAtFrom).toBe("2026-09-07T08:00:00.000Z");
    expect(query.startsAtTo).toBe("2026-09-07T12:00:00.000Z");
  });

  it("does not make an unfiltered API request for the unsupported board-game selection", async () => {
    const api = createApi();
    render(
      <AuthSessionProvider api={api}>
        <SignedInDiscovery filters={{ ...defaultHomeFilters, activity: "보드게임" }} />
      </AuthSessionProvider>,
    );

    expect(await screen.findByRole("heading", { name: "현재 지원하지 않는 활동이에요" })).toBeInTheDocument();
    expect(screen.getByText("보드게임 활동은 아직 서버 탐색에서 지원하지 않아요.")).toBeInTheDocument();
    expect(api.listMeetups).not.toHaveBeenCalled();
  });

  it("renders loading, server rows, and cursor pagination", async () => {
    const next = { ...meetup, id: "c7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", title: "두 번째 서버 모임" };
    const api = createApi({
      listMeetups: vi.fn().mockResolvedValueOnce({ items: [meetup], nextCursor: "next-cursor" }).mockResolvedValueOnce({ items: [next] }),
    });
    renderDiscovery(api);

    expect(await screen.findByRole("status")).toHaveTextContent("모임을 불러오는 중이에요");
    expect(await screen.findByRole("link", { name: /서버 한강 산책/ })).toHaveAttribute("href", `/meetups/${meetup.id}`);
    fireEvent.click(screen.getByRole("button", { name: "모임 더 보기" }));
    expect(await screen.findByRole("link", { name: /두 번째 서버 모임/ })).toBeInTheDocument();
    expect(api.listMeetups).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "next-cursor" }),
      "access",
    );
  });

  it("accepts a privacy-redacted list venue payload without rendering undefined", async () => {
    const api = createApi({
      listMeetups: vi.fn().mockResolvedValue({ items: [{ ...meetup, venue: {} }] }),
    });
    renderDiscovery(api);

    expect(await screen.findByRole("link", { name: /서버 한강 산책/ })).toBeInTheDocument();
    expect(screen.queryByText(/^undefined$/)).not.toBeInTheDocument();
  });

  it("preserves the loaded page and retries the same cursor after a pagination failure", async () => {
    const next = { ...meetup, id: "c7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", title: "두 번째 서버 모임" };
    const api = createApi({
      listMeetups: vi.fn()
        .mockResolvedValueOnce({ items: [meetup], nextCursor: "next-cursor" })
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ items: [next] }),
    });
    renderDiscovery(api);

    expect(await screen.findByRole("link", { name: /서버 한강 산책/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "모임 더 보기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("모임을 불러오지 못했어요");
    expect(screen.getByRole("link", { name: /서버 한강 산책/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("link", { name: /두 번째 서버 모임/ })).toBeInTheDocument();
    expect(api.listMeetups).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "next-cursor" }), "access");
  });

  it("offers problem retry and preserves the server empty state", async () => {
    const api = createApi({ listMeetups: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [] }) });
    renderDiscovery(api);

    expect(await screen.findByRole("alert")).toHaveTextContent("모임을 불러오지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("조건에 맞는 모임이 없어요"),
    );
  });

  it("drops an old account's late discovery page after a session replacement", async () => {
    const oldPage = deferred<{ items: typeof meetup[] }>();
    const replacementMeetup = { ...meetup, id: "d7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", title: "새 계정 모임" };
    const api = createApi({
      createSession: vi.fn(({ requestId }) =>
        Promise.resolve({
          accessToken: requestId === replacementUser.id ? "replacement-access" : "old-access",
          refreshToken: "refresh",
          expiresIn: 900,
          user: requestId === replacementUser.id ? replacementUser : user,
        }),
      ),
      listMeetups: vi.fn().mockReturnValueOnce(oldPage.promise).mockResolvedValueOnce({ items: [replacementMeetup] }),
    });
    render(<AuthSessionProvider api={api}><SwitchableDiscovery /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: user.id, otp: "123456" });
    });
    await waitFor(() => expect(api.listMeetups).toHaveBeenCalledTimes(1));
    await act(async () => {
      await latestSession.createSession({ requestId: replacementUser.id, otp: "654321" });
    });
    expect(await screen.findByRole("link", { name: /새 계정 모임/ })).toBeInTheDocument();

    await act(async () => {
      oldPage.resolve({ items: [meetup] });
      await Promise.resolve();
    });
    expect(screen.queryByRole("link", { name: /서버 한강 산책/ })).not.toBeInTheDocument();
  });

  it("drops a late page for the same subject after logout and re-login", async () => {
    const oldPage = deferred<{ items: typeof meetup[] }>();
    const reloginMeetup = { ...meetup, id: "e7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", title: "재로그인 모임" };
    const api = createApi({
      listMeetups: vi.fn().mockReturnValueOnce(oldPage.promise).mockResolvedValueOnce({ items: [reloginMeetup] }),
    });
    render(<AuthSessionProvider api={api}><SwitchableDiscovery /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: user.id, otp: "123456" });
    });
    await waitFor(() => expect(api.listMeetups).toHaveBeenCalledTimes(1));

    await act(async () => {
      await latestSession.logout();
    });
    expect(screen.getByRole("status")).toHaveTextContent(/불러오는 중|로그인 후/);

    await act(async () => {
      await latestSession.createSession({ requestId: user.id, otp: "654321" });
    });
    await waitFor(() => expect(api.listMeetups).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("link", { name: /재로그인 모임/ })).toBeInTheDocument();

    await act(async () => {
      oldPage.resolve({ items: [meetup] });
      await Promise.resolve();
    });
    expect(screen.queryByRole("link", { name: /서버 한강 산책/ })).not.toBeInTheDocument();
  });
});
