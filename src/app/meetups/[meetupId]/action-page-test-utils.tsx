import { render } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { vi } from "vitest";

import type { BungaeApi } from "@/lib/api/client";
import type { Meetup } from "@/lib/api/types";
import { AuthSessionProvider, type AuthSessionContextValue, useAuthSession } from "@/lib/auth/auth-session-provider";

export const user = {
  id: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  displayName: "민지",
  ageBand: "25_34" as const,
  interestCodes: ["WALK"],
  homeAreaCode: "MAPO",
  adultVerified: true,
  identityVerified: true,
  version: 1,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

export const anotherUser = { ...user, id: "b7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", displayName: "서연" };

export const meetup: Meetup = {
  id: "demo", activityCode: "WALK", title: "서버 한강 산책",
  startsAt: "2026-09-07T09:30:00.000Z", endsAt: "2026-09-07T11:00:00.000Z",
  minimumParticipants: 2, capacity: 4, venue: {}, cost: 0, alcoholPolicy: "NOT_ALLOWED",
  state: "OPEN", joinedCount: 2, version: 1, allowedActions: [],
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  joinDeadline: "2026-09-07T09:00:00.000Z", quorumStatus: "PENDING",
};

export function actionMeetup(action: Meetup["allowedActions"][number], version = 1): Meetup {
  return { ...meetup, allowedActions: [action], version };
}

export function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn(),
    createSession: vi.fn().mockResolvedValue({ accessToken: "access", refreshToken: "refresh", expiresIn: 900, user }),
    refreshSession: vi.fn(), getMe: vi.fn(), updateMe: vi.fn(), getActivityPolicies: vi.fn(),
    createVerificationSession: vi.fn(), listMeetups: vi.fn(), getMeetup: vi.fn().mockResolvedValue(meetup),
    createMeetup: vi.fn(), joinMeetup: vi.fn(), leaveMeetup: vi.fn(), cancelMeetup: vi.fn(),
    decideQuorum: vi.fn(), checkInMeetup: vi.fn(), searchPlaces: vi.fn(),
    deleteCurrentSession: vi.fn(), putPushDevice: vi.fn(), deletePushDevice: vi.fn(),
    listMyMeetups: vi.fn(), listNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(),
    listMeetupMessages: vi.fn(), createMeetupMessage: vi.fn(),
    createReport: vi.fn(), createFeedback: vi.fn(), listParticipants: vi.fn().mockResolvedValue({ items: [] }), createConnectionIntent: vi.fn(), listConnections: vi.fn(), deleteConnection: vi.fn(), listBlocks: vi.fn(), createBlock: vi.fn(), deleteBlock: vi.fn(),
    createImpressions: vi.fn(), createNextIntent: vi.fn(),
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

let latestSession: AuthSessionContextValue | null = null;

function SignedIn({ children }: { children: ReactNode }) {
  const session = useAuthSession();
  const { createSession } = session;
  latestSession = session;
  useEffect(() => { void createSession({ requestId: user.id, otp: "123456" }); }, [createSession]);
  return <>{children}</>;
}

export function getLatestSession(): AuthSessionContextValue {
  if (!latestSession) throw new Error("The test session has not rendered");
  return latestSession;
}
export function AuthenticatedTestRoot({ api, children }: { api: BungaeApi; children: ReactNode }) {
  return <AuthSessionProvider api={api}><SignedIn>{children}</SignedIn></AuthSessionProvider>;
}

export function renderAuthenticated(page: ReactNode, api: BungaeApi) {
  return render(<AuthenticatedTestRoot api={api}>{page}</AuthenticatedTestRoot>);
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}
