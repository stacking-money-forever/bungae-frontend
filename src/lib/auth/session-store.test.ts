import { describe, expect, it, vi } from "vitest";
import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import type { TokenSession, UserProfile } from "@/lib/api/types";
import { AuthSessionStore, SessionExpiredError } from "@/lib/auth/session-store";

const user = {
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

const anotherUser: UserProfile = {
  ...user,
  id: "b7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  displayName: "서연",
};

function tokenSession(overrides: Partial<TokenSession> = {}): TokenSession {
  return {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    expiresIn: 900,
    user,
    ...overrides,
  };
}

function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn(),
    createSession: vi.fn().mockResolvedValue(tokenSession()),
    refreshSession: vi.fn().mockResolvedValue(tokenSession({ accessToken: "access-2" })),
    getMe: vi.fn().mockResolvedValue(user),
    updateMe: vi.fn().mockResolvedValue(user),
    getActivityPolicies: vi.fn(),
    createVerificationSession: vi.fn(),
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
    deleteCurrentSession: vi.fn().mockResolvedValue(undefined),
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

describe("withdrawal session actions", () => {
  it("uses the current access token for schedule lookup, request, and cancellation", async () => {
    const withdrawal = {
      id: "withdrawal-1",
      state: "SCHEDULED" as const,
      requestedAt: "2026-09-08T00:00:00Z",
      effectiveAt: "2026-09-15T00:00:00Z",
      cancelledAt: null,
      completedAt: null,
      version: 2,
    };
    const api = createApi({
      getWithdrawal: vi.fn().mockResolvedValue(null),
      scheduleWithdrawal: vi.fn().mockResolvedValue(withdrawal),
      cancelWithdrawal: vi.fn().mockResolvedValue(undefined),
    });
    const store = new AuthSessionStore(api);
    await store.createSession({ requestId: user.id, otp: "123456" });

    await expect(store.getWithdrawal()).resolves.toBeNull();
    await expect(store.scheduleWithdrawal("withdrawal-key")).resolves.toEqual(withdrawal);
    await expect(store.cancelWithdrawal(2)).resolves.toBeUndefined();

    expect(api.getWithdrawal).toHaveBeenCalledWith("access-1");
    expect(api.scheduleWithdrawal).toHaveBeenCalledWith("withdrawal-key", "access-1");
    expect(api.cancelWithdrawal).toHaveBeenCalledWith(2, "access-1");
  });
});

describe("AuthSessionStore", () => {
  it("keeps a successful OTP session only in memory", async () => {
    const api = createApi();
    const store = new AuthSessionStore(api);

    await store.createSession({ requestId: user.id, otp: "123456" });

    expect(store.getSnapshot()).toEqual({ status: "authenticated", user });
    await expect(store.getAccessToken()).resolves.toBe("access-1");
    expect(api.createSession).toHaveBeenCalledWith({ requestId: user.id, otp: "123456" });
  });

  it("refreshes exactly once for concurrent expired-token callers", async () => {
    let clock = 0;
    const api = createApi({
      createSession: vi.fn().mockResolvedValue(tokenSession({ expiresIn: 1 })),
      refreshSession: vi.fn().mockResolvedValue(tokenSession({ accessToken: "access-2" })),
    });
    const store = new AuthSessionStore(api, () => clock);
    await store.createSession({ requestId: user.id, otp: "123456" });
    clock = 1_000;

    await expect(Promise.all([store.getAccessToken(), store.getAccessToken()])).resolves.toEqual([
      "access-2",
      "access-2",
    ]);
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    expect(api.refreshSession).toHaveBeenCalledWith("refresh-1");
  });

  it("retries one unauthorized protected request after refresh", async () => {
    const getMe = vi
      .fn()
      .mockRejectedValueOnce(new ApiProblemError(401, null))
      .mockResolvedValueOnce({ ...user, displayName: "서연" });
    const api = createApi({ getMe });
    const store = new AuthSessionStore(api);
    await store.createSession({ requestId: user.id, otp: "123456" });

    await expect(store.getMe()).resolves.toMatchObject({ displayName: "서연" });
    expect(getMe).toHaveBeenNthCalledWith(1, "access-1");
    expect(getMe).toHaveBeenNthCalledWith(2, "access-2");
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("clears the session when refresh fails", async () => {
    let clock = 0;
    const api = createApi({
      createSession: vi.fn().mockResolvedValue(tokenSession({ expiresIn: 1 })),
      refreshSession: vi.fn().mockRejectedValue(new ApiProblemError(401, null)),
    });
    const store = new AuthSessionStore(api, () => clock);
    await store.createSession({ requestId: user.id, otp: "123456" });
    clock = 1_000;

    await expect(store.getAccessToken()).resolves.toBeNull();
    expect(store.getSnapshot()).toEqual({ status: "anonymous", user: null });
  });

  it("does not let an old refresh resolve with a replacement session", async () => {
    let clock = 0;
    const oldRefresh = deferred<TokenSession>();
    const api = createApi({
      createSession: vi
        .fn()
        .mockResolvedValueOnce(tokenSession({ accessToken: "old-access", refreshToken: "old-refresh", expiresIn: 1 }))
        .mockResolvedValueOnce(
          tokenSession({ accessToken: "new-access", refreshToken: "new-refresh", user: anotherUser }),
        ),
      refreshSession: vi.fn().mockReturnValue(oldRefresh.promise),
    });
    const store = new AuthSessionStore(api, () => clock);
    await store.createSession({ requestId: user.id, otp: "123456" });
    clock = 1_000;
    const oldToken = store.getAccessToken();
    expect(api.refreshSession).toHaveBeenCalledWith("old-refresh");

    await store.createSession({ requestId: anotherUser.id, otp: "654321" });
    oldRefresh.resolve(tokenSession({ accessToken: "old-refreshed", refreshToken: "old-refresh-2" }));

    await expect(oldToken).resolves.toBeNull();
    await expect(store.getAccessToken()).resolves.toBe("new-access");
    expect(store.getSnapshot()).toEqual({ status: "authenticated", user: anotherUser });
  });

  it("does not refresh or retry an unauthorized request after an account switch", async () => {
    const firstRequestStarted = deferred<void>();
    const firstRequestResult = deferred<UserProfile>();
    const getMe = vi.fn(() => {
      firstRequestStarted.resolve();
      return firstRequestResult.promise;
    });
    const api = createApi({
      createSession: vi
        .fn()
        .mockResolvedValueOnce(tokenSession({ accessToken: "old-access", refreshToken: "old-refresh" }))
        .mockResolvedValueOnce(
          tokenSession({ accessToken: "new-access", refreshToken: "new-refresh", user: anotherUser }),
        ),
      getMe,
    });
    const store = new AuthSessionStore(api);
    await store.createSession({ requestId: user.id, otp: "123456" });
    const oldRequest = store.getMe();
    await firstRequestStarted.promise;

    await store.createSession({ requestId: anotherUser.id, otp: "654321" });
    firstRequestResult.reject(new ApiProblemError(401, null));

    await expect(oldRequest).rejects.toBeInstanceOf(SessionExpiredError);
    expect(api.refreshSession).not.toHaveBeenCalled();
    expect(getMe).toHaveBeenCalledTimes(1);
    await expect(store.getAccessToken()).resolves.toBe("new-access");
  });

  it("does not resurrect local secrets when logout clears during a refresh", async () => {
    let clock = 0;
    const oldRefresh = deferred<TokenSession>();
    const api = createApi({
      createSession: vi.fn().mockResolvedValue(tokenSession({ expiresIn: 1 })),
      refreshSession: vi.fn().mockReturnValue(oldRefresh.promise),
    });
    const store = new AuthSessionStore(api, () => clock);
    await store.createSession({ requestId: user.id, otp: "123456" });
    clock = 1_000;
    const logout = store.deleteCurrentSession();
    expect(api.refreshSession).toHaveBeenCalledTimes(1);

    store.clear();
    oldRefresh.resolve(tokenSession({ accessToken: "late-access" }));

    await expect(logout).resolves.toMatchObject({ ok: false, attempted: true });
    expect(api.deleteCurrentSession).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual({ status: "anonymous", user: null });
    await expect(store.getAccessToken()).resolves.toBeNull();
  });

  it("allows a new expired session to refresh independently of an old refresh", async () => {
    let clock = 0;
    const oldRefresh = deferred<TokenSession>();
    const newRefresh = deferred<TokenSession>();
    const api = createApi({
      createSession: vi
        .fn()
        .mockResolvedValueOnce(tokenSession({ accessToken: "old-access", refreshToken: "old-refresh", expiresIn: 1 }))
        .mockResolvedValueOnce(
          tokenSession({
            accessToken: "new-access",
            refreshToken: "new-refresh",
            expiresIn: 1,
            user: anotherUser,
          }),
        ),
      refreshSession: vi.fn((refreshToken: string) =>
        refreshToken === "old-refresh" ? oldRefresh.promise : newRefresh.promise,
      ),
    });
    const store = new AuthSessionStore(api, () => clock);
    await store.createSession({ requestId: user.id, otp: "123456" });
    clock = 1_000;
    const oldToken = store.getAccessToken();
    await store.createSession({ requestId: anotherUser.id, otp: "654321" });
    clock = 2_000;
    const newToken = store.getAccessToken();
    expect(api.refreshSession).toHaveBeenCalledWith("old-refresh");
    expect(api.refreshSession).toHaveBeenCalledWith("new-refresh");

    oldRefresh.resolve(tokenSession({ accessToken: "old-refreshed", refreshToken: "old-refresh-2" }));
    newRefresh.resolve(
      tokenSession({
        accessToken: "new-refreshed",
        refreshToken: "new-refresh-2",
        user: anotherUser,
      }),
    );

    await expect(oldToken).resolves.toBeNull();
    await expect(newToken).resolves.toBe("new-refreshed");
    expect(store.getSnapshot()).toEqual({ status: "authenticated", user: anotherUser });
  });

  it("does not store a session when an asynchronous verification becomes stale", async () => {
    const pendingSession = deferred<TokenSession>();
    const api = createApi({ createSession: vi.fn().mockReturnValue(pendingSession.promise) });
    const store = new AuthSessionStore(api);
    const creation = store.createSession({ requestId: user.id, otp: "123456" }, () => false);

    pendingSession.resolve(tokenSession({ accessToken: "discarded-access-token" }));

    await expect(creation).resolves.toBeNull();
    expect(store.getSnapshot()).toEqual({ status: "anonymous", user: null });
    await expect(store.getAccessToken()).resolves.toBeNull();
  });
  it("does not let late profile patch or verification results cross an account switch", async () => {
    const pendingPatch = deferred<UserProfile>();
    const pendingVerification = deferred<{
      verificationSessionId: string;
      providerUrl: string;
      expiresAt: string;
    }>();
    const api = createApi({
      createSession: vi
        .fn()
        .mockResolvedValueOnce(tokenSession({ accessToken: "old-access", refreshToken: "old-refresh" }))
        .mockResolvedValueOnce(
          tokenSession({ accessToken: "new-access", refreshToken: "new-refresh", user: anotherUser }),
        ),
      updateMe: vi.fn().mockReturnValue(pendingPatch.promise),
      createVerificationSession: vi.fn().mockReturnValue(pendingVerification.promise),
    });
    const store = new AuthSessionStore(api);
    await store.createSession({ requestId: user.id, otp: "123456" });

    const oldPatch = store.updateMe({ displayName: "이전 계정" }, user.version);
    const oldVerification = store.createVerificationSession();
    await store.createSession({ requestId: anotherUser.id, otp: "654321" });
    pendingPatch.resolve({ ...user, displayName: "이전 계정" });
    pendingVerification.resolve({
      verificationSessionId: user.id,
      providerUrl: "https://verify.example/old-session",
      expiresAt: "2026-09-07T00:15:00.000Z",
    });

    await expect(oldPatch).rejects.toBeInstanceOf(SessionExpiredError);
    await expect(oldVerification).rejects.toBeInstanceOf(SessionExpiredError);
    expect(store.getSnapshot()).toEqual({ status: "authenticated", user: anotherUser });
  });

  it("forwards authenticated meetup, report, and block contracts with the access token", async () => {
    const report = {
      targetType: "MEETUP" as const,
      meetupId: "meetup-1",
      category: "SAFETY" as const,
      urgency: "P1" as const,
      details: "안전 우려",
      evidenceUploadIds: [],
    };
    const api = createApi({
      cancelMeetup: vi.fn().mockResolvedValue({ id: "meetup-1" }),
      decideQuorum: vi.fn().mockResolvedValue({ meetupId: "meetup-1", quorumDecision: "PROCEED" }),
      checkInMeetup: vi.fn().mockResolvedValue({ participationId: "participant-1", state: "CHECKED_IN" }),
      listMyMeetups: vi.fn().mockResolvedValue({ items: [] }),
      listNotifications: vi.fn().mockResolvedValue({ items: [] }),
      markNotificationRead: vi.fn().mockResolvedValue({ notificationId: "notice-1", type: "UNKNOWN", createdAt: "2026-09-07T00:00:00Z", state: "READ", version: 2 }),
      markAllNotificationsRead: vi.fn().mockResolvedValue({ updatedCount: 1, readAt: "2026-09-07T00:00:00Z" }),
      listMeetupMessages: vi.fn().mockResolvedValue({ items: [] }),
      createMeetupMessage: vi.fn().mockResolvedValue({ id: "message-1", sender: { userId: user.id, displayName: user.displayName }, text: "안녕하세요", createdAt: "2026-09-07T00:00:00Z" }),
      createReport: vi.fn().mockResolvedValue({ incidentId: "incident-1", state: "RECEIVED", priority: "P1", submittedAt: "2026-09-07T00:00:00Z" }),
      listBlocks: vi.fn().mockResolvedValue({ items: [] }),
      createBlock: vi.fn().mockResolvedValue({ blockedUserId: "user-2", createdAt: "2026-09-07T00:00:00Z" }),
      deleteBlock: vi.fn().mockResolvedValue(undefined),
    });
    const store = new AuthSessionStore(api);
    await store.createSession({ requestId: user.id, otp: "123456" });

    await store.cancelMeetup("meetup-1", { reason: "안전 우려" }, "cancel-key");
    await store.decideQuorum("meetup-1", "PROCEED", 3, "quorum-key");
    await store.checkInMeetup("meetup-1", { method: "MEETUP_CODE", code: "MANGO 27" }, "check-key");
    await store.listMyMeetups({ relation: "ALL", limit: 20 });
    await store.listNotifications({ cursor: "next", limit: 20 });
    await store.markNotificationRead("notice-1", 1);
    await store.markAllNotificationsRead();
    await store.listMeetupMessages("meetup-1", { cursor: "next", limit: 20 });
    await store.createMeetupMessage("meetup-1", "안녕하세요", "message-key");
    await store.createReport(report, "report-key");
    await store.listBlocks({ cursor: "next", limit: 20 });
    await store.createBlock("user-2");
    await store.deleteBlock("id/with space");
    await store.listParticipants("meetup-1", { cursor: "next", limit: 20 });
    await store.createConnectionIntent("meetup-1", { targetUserIds: ["user-2"] });
    await store.listConnections({ cursor: "next", limit: 20 });
    await store.deleteConnection("connection-1");

    expect(api.cancelMeetup).toHaveBeenCalledWith("meetup-1", { reason: "안전 우려" }, "cancel-key", "access-1");
    expect(api.decideQuorum).toHaveBeenCalledWith("meetup-1", "PROCEED", 3, "quorum-key", "access-1");
    expect(api.checkInMeetup).toHaveBeenCalledWith("meetup-1", { method: "MEETUP_CODE", code: "MANGO 27" }, "check-key", "access-1");
    expect(api.listMyMeetups).toHaveBeenCalledWith({ relation: "ALL", limit: 20 }, "access-1");
    expect(api.listNotifications).toHaveBeenCalledWith({ cursor: "next", limit: 20 }, "access-1");
    expect(api.markNotificationRead).toHaveBeenCalledWith("notice-1", 1, "access-1");
    expect(api.markAllNotificationsRead).toHaveBeenCalledWith("access-1");
    expect(api.listMeetupMessages).toHaveBeenCalledWith("meetup-1", { cursor: "next", limit: 20 }, "access-1");
    expect(api.createMeetupMessage).toHaveBeenCalledWith("meetup-1", "안녕하세요", "message-key", "access-1");
    expect(api.createReport).toHaveBeenCalledWith(report, "report-key", "access-1");
    expect(api.listBlocks).toHaveBeenCalledWith({ cursor: "next", limit: 20 }, "access-1");
    expect(api.createBlock).toHaveBeenCalledWith("user-2", "access-1");
    expect(api.deleteBlock).toHaveBeenCalledWith("id/with space", "access-1");
    expect(api.listParticipants).toHaveBeenCalledWith("meetup-1", { cursor: "next", limit: 20 }, "access-1");
    expect(api.createConnectionIntent).toHaveBeenCalledWith("meetup-1", { targetUserIds: ["user-2"] }, "access-1");
    expect(api.listConnections).toHaveBeenCalledWith({ cursor: "next", limit: 20 }, "access-1");
    expect(api.deleteConnection).toHaveBeenCalledWith("connection-1", "access-1");
  });
  it("forwards feedback without an idempotency key using the authenticated access token", async () => {
    const input = {
      expectationMatch: 5 as const,
      feltSafe: 4 as const,
      facilitationComfort: 3 as const,
      wouldUseAgain: 2 as const,
      privateComment: "좋았어요.",
    };
    const api = createApi({
      createFeedback: vi.fn().mockResolvedValue({ id: "receipt-1", createdAt: "2026-09-07T00:00:00Z" }),
    });
    const store = new AuthSessionStore(api);
    await store.createSession({ requestId: user.id, otp: "123456" });

    await store.createFeedback("meetup-1", input);

    expect(api.createFeedback).toHaveBeenCalledWith("meetup-1", input, "access-1");
  });
  it("rejects a late meetup action completion after an account switch", async () => {
    const pendingCancel = deferred<unknown>();
    const api = createApi({
      createSession: vi
        .fn()
        .mockResolvedValueOnce(tokenSession({ accessToken: "old-access" }))
        .mockResolvedValueOnce(tokenSession({ accessToken: "new-access", user: anotherUser })),
      cancelMeetup: vi.fn().mockReturnValue(pendingCancel.promise),
    });
    const store = new AuthSessionStore(api);
    await store.createSession({ requestId: user.id, otp: "123456" });
    const cancel = store.cancelMeetup("meetup-1", { reason: "안전 우려" }, "cancel-key");
    await Promise.resolve();

    await store.createSession({ requestId: anotherUser.id, otp: "654321" });
    pendingCancel.resolve({});

    await expect(cancel).rejects.toBeInstanceOf(SessionExpiredError);
    expect(store.getSnapshot()).toEqual({ status: "authenticated", user: anotherUser });
  });
});
