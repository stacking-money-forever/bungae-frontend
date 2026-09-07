import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BungaeApi } from "@/lib/api/client";
import {
  AuthSessionProvider,
  type AuthSessionContextValue,
  type LogoutResult,
  useAuthSession,
} from "@/lib/auth/auth-session-provider";

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

const replacementUser = {
  ...user,
  id: "c7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  displayName: "서연",
};

function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn(),
    createSession: vi.fn().mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      user,
    }),
    refreshSession: vi.fn(),
    getMe: vi.fn(),
    updateMe: vi.fn(),
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

let latest: AuthSessionContextValue;

function SessionProbe() {
  latest = useAuthSession();
  return <output data-testid="auth-state">{latest.snapshot.status}</output>;
}

function EpochProbe() {
  latest = useAuthSession();
  return (
    <output data-testid="epoch">{String(latest.sessionEpoch)}</output>
  );
}

describe("AuthSessionProvider", () => {
  it("does not persist tokens and injects push only after authentication", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const api = createApi();
    render(
      <AuthSessionProvider api={api}>
        <SessionProbe />
      </AuthSessionProvider>,
    );

    expect(latest.pushDependencies).toBeUndefined();
    await act(async () => {
      await latest.createSession({ requestId: user.id, otp: "123456" });
    });

    expect(screen.getByTestId("auth-state")).toHaveTextContent("authenticated");
    expect(latest.pushDependencies?.session?.subject).toBe(user.id);
    await expect(latest.pushDependencies?.session?.getAccessToken()).resolves.toBe("access-token");
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("unsubscribes with the owner session, attempts remote logout, then clears local secrets", async () => {
    const order: string[] = [];
    const api = createApi({
      deleteCurrentSession: vi.fn().mockImplementation(async () => {
        order.push("session");
        throw new Error("offline");
      }),
    });
    const unsubscribePush = vi.fn().mockImplementation(async (dependencies) => {
      order.push("push");
      expect(dependencies.session.subject).toBe(user.id);
      await expect(dependencies.session.getAccessToken()).resolves.toBe("access-token");
      return { ok: true };
    });
    render(
      <AuthSessionProvider api={api} unsubscribePush={unsubscribePush}>
        <SessionProbe />
      </AuthSessionProvider>,
    );
    await act(async () => {
      await latest.createSession({ requestId: user.id, otp: "123456" });
    });

    let result: LogoutResult | undefined;
    await act(async () => {
      result = await latest.logout();
    });

    expect(order).toEqual(["push", "session"]);
    expect(result).toMatchObject({ ok: false, remote: { ok: false, attempted: true } });
    expect(screen.getByTestId("auth-state")).toHaveTextContent("anonymous");
    await expect(latest.getAccessToken()).resolves.toBeNull();
  });

  it("exposes authenticated meetup, report, and block actions through the provider", async () => {
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
      decideQuorum: vi.fn().mockResolvedValue({ meetupId: "meetup-1" }),
      checkInMeetup: vi.fn().mockResolvedValue({ participationId: "participant-1" }),
      listMyMeetups: vi.fn().mockResolvedValue({ items: [] }),
      listNotifications: vi.fn().mockResolvedValue({ items: [] }),
      markNotificationRead: vi.fn().mockResolvedValue({ notificationId: "notice-1", type: "UNKNOWN", createdAt: "2026-09-07T00:00:00Z", state: "READ", version: 2 }),
      markAllNotificationsRead: vi.fn().mockResolvedValue({ updatedCount: 1, readAt: "2026-09-07T00:00:00Z" }),
      listMeetupMessages: vi.fn().mockResolvedValue({ items: [] }),
      createMeetupMessage: vi.fn().mockResolvedValue({ id: "message-1", sender: { userId: user.id, displayName: user.displayName }, text: "안녕하세요", createdAt: "2026-09-07T00:00:00Z" }),
      createReport: vi.fn().mockResolvedValue({ incidentId: "incident-1", state: "RECEIVED", priority: "P1", submittedAt: "2026-09-07T00:00:00Z" }),
      getWithdrawal: vi.fn().mockResolvedValue(null),
      scheduleWithdrawal: vi.fn().mockResolvedValue({ id: "withdrawal-1", state: "SCHEDULED", requestedAt: "2026-09-08T00:00:00Z", effectiveAt: "2026-09-15T00:00:00Z", cancelledAt: null, completedAt: null, version: 2 }),
      cancelWithdrawal: vi.fn().mockResolvedValue(undefined),
      listBlocks: vi.fn().mockResolvedValue({ items: [] }),
      createBlock: vi.fn().mockResolvedValue({ blockedUserId: "user-2", createdAt: "2026-09-07T00:00:00Z" }),
      deleteBlock: vi.fn().mockResolvedValue(undefined),
    });
    render(<AuthSessionProvider api={api}><SessionProbe /></AuthSessionProvider>);
    await act(async () => {
      await latest.createSession({ requestId: user.id, otp: "123456" });
      await latest.cancelMeetup("meetup-1", { reason: "안전 우려" }, "cancel-key");
      await latest.decideQuorum("meetup-1", "CANCEL", 2, "quorum-key");
      await latest.checkInMeetup("meetup-1", { method: "MEETUP_CODE", code: "MANGO 27" }, "check-key");
      await latest.listMyMeetups({ relation: "ALL", limit: 20 });
      await latest.listNotifications({ cursor: "next", limit: 20 });
      await latest.markNotificationRead("notice-1", 1);
      await latest.markAllNotificationsRead();
      await latest.listMeetupMessages("meetup-1", { cursor: "next", limit: 20 });
      await latest.createMeetupMessage("meetup-1", "안녕하세요", "message-key");
      await latest.createReport(report, "report-key");
      await latest.listBlocks({ cursor: "next", limit: 20 });
      await latest.createBlock("user-2");
      await latest.deleteBlock("id/with space");
      await latest.listParticipants("meetup/with space", { cursor: "next/value", limit: 20 });
      await latest.getWithdrawal();
      await latest.scheduleWithdrawal("withdrawal-key");
      await latest.cancelWithdrawal(2);
      await latest.createNoShowAppeal("meetup-1", { reason: "기록이 정확하지 않아요." });
      await latest.listNoShowAppeals();
      await latest.getNoShowAppeal("appeal-1");
      await latest.listIncidents({ cursor: "next/value", limit: 20 });
      await latest.createConnectionIntent("meetup/with space", { targetUserIds: ["user-2"] });
      await latest.listConnections({ cursor: "next/value", limit: 20 });
      await latest.deleteConnection("connection/with space");
    });

    expect(api.cancelMeetup).toHaveBeenCalledWith("meetup-1", { reason: "안전 우려" }, "cancel-key", "access-token");
    expect(api.decideQuorum).toHaveBeenCalledWith("meetup-1", "CANCEL", 2, "quorum-key", "access-token");
    expect(api.checkInMeetup).toHaveBeenCalledWith("meetup-1", { method: "MEETUP_CODE", code: "MANGO 27" }, "check-key", "access-token");
    expect(api.listMyMeetups).toHaveBeenCalledWith({ relation: "ALL", limit: 20 }, "access-token");
    expect(api.listNotifications).toHaveBeenCalledWith({ cursor: "next", limit: 20 }, "access-token");
    expect(api.markNotificationRead).toHaveBeenCalledWith("notice-1", 1, "access-token");
    expect(api.markAllNotificationsRead).toHaveBeenCalledWith("access-token");
    expect(api.listMeetupMessages).toHaveBeenCalledWith("meetup-1", { cursor: "next", limit: 20 }, "access-token");
    expect(api.createMeetupMessage).toHaveBeenCalledWith("meetup-1", "안녕하세요", "message-key", "access-token");
    expect(api.createReport).toHaveBeenCalledWith(report, "report-key", "access-token");
    expect(api.listBlocks).toHaveBeenCalledWith({ cursor: "next", limit: 20 }, "access-token");
    expect(api.createBlock).toHaveBeenCalledWith("user-2", "access-token");
    expect(api.deleteBlock).toHaveBeenCalledWith("id/with space", "access-token");
    expect(api.listParticipants).toHaveBeenCalledWith("meetup/with space", { cursor: "next/value", limit: 20 }, "access-token");
    expect(api.getWithdrawal).toHaveBeenCalledWith("access-token");
    expect(api.scheduleWithdrawal).toHaveBeenCalledWith("withdrawal-key", "access-token");
    expect(api.cancelWithdrawal).toHaveBeenCalledWith(2, "access-token");
    expect(api.createNoShowAppeal).toHaveBeenCalledWith("meetup-1", { reason: "기록이 정확하지 않아요." }, "access-token");
    expect(api.listNoShowAppeals).toHaveBeenCalledWith("access-token");
    expect(api.getNoShowAppeal).toHaveBeenCalledWith("appeal-1", "access-token");
    expect(api.listIncidents).toHaveBeenCalledWith({ cursor: "next/value", limit: 20 }, "access-token");
    expect(api.createConnectionIntent).toHaveBeenCalledWith("meetup/with space", { targetUserIds: ["user-2"] }, "access-token");
    expect(api.listConnections).toHaveBeenCalledWith({ cursor: "next/value", limit: 20 }, "access-token");
    expect(api.deleteConnection).toHaveBeenCalledWith("connection/with space", "access-token");
  });
  it("exposes authenticated feedback submission without an idempotency key", async () => {
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
    render(<AuthSessionProvider api={api}><SessionProbe /></AuthSessionProvider>);
    await act(async () => {
      await latest.createSession({ requestId: user.id, otp: "123456" });
      await latest.createFeedback("meetup-1", input);
    });

    expect(api.createFeedback).toHaveBeenCalledWith("meetup-1", input, "access-token");
  });

  it("starts a new epoch on login, account switch, logout, and re-login", async () => {
    const api = createApi({
      createSession: vi.fn(({ requestId }) =>
        Promise.resolve({
          accessToken: "access",
          refreshToken: "refresh",
          expiresIn: 900,
          user: requestId === replacementUser.id ? replacementUser : user,
        }),
      ),
    });
    render(
      <AuthSessionProvider api={api}>
        <EpochProbe />
      </AuthSessionProvider>,
    );

    expect(screen.getByTestId("epoch")).toHaveTextContent("0");

    await act(async () => {
      await latest.createSession({ requestId: user.id, otp: "123456" });
    });
    expect(screen.getByTestId("epoch")).toHaveTextContent("1");

    await act(async () => {
      await latest.createSession({ requestId: replacementUser.id, otp: "654321" });
    });
    expect(screen.getByTestId("epoch")).toHaveTextContent("2");

    await act(async () => {
      await latest.logout();
    });
    expect(screen.getByTestId("epoch")).toHaveTextContent("3");

    await act(async () => {
      await latest.createSession({ requestId: user.id, otp: "123456" });
    });
    expect(screen.getByTestId("epoch")).toHaveTextContent("4");
  });
});
