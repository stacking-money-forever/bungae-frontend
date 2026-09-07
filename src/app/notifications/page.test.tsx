import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import type { BungaeApi } from "@/lib/api/client";
import type { PushDependencies } from "@/lib/pwa/push";
import {
  AuthSessionProvider,
  useAuthSession,
} from "@/lib/auth/auth-session-provider";

const pushSettingsCard = vi.hoisted(() =>
  vi.fn<(props: { dependencies?: PushDependencies }) => null>(() => null),
);

vi.mock("@/components/push-settings-card", () => ({
  PushSettingsCard: pushSettingsCard,
}));

import NotificationsSurface from "./page";

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

function createApi(): BungaeApi {
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
    listNotifications: vi.fn().mockResolvedValue({ items: [] }),
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
  };
}

function AuthenticatedNotifications() {
  const { createSession } = useAuthSession();
  useEffect(() => {
    void createSession({ requestId: user.id, otp: "123456" });
  }, [createSession]);
  return <NotificationsSurface />;
}

describe("NotificationsSurface", () => {
  it("keeps push unavailable before auth and injects the authenticated owner session after it", async () => {
    pushSettingsCard.mockClear();
    render(
      <AuthSessionProvider api={createApi()}>
        <AuthenticatedNotifications />
      </AuthSessionProvider>,
    );

    const initialProps = pushSettingsCard.mock.calls[0]?.[0];
    expect(initialProps).toEqual(expect.objectContaining({ dependencies: undefined }));
    await waitFor(() => {
      expect(pushSettingsCard.mock.calls.at(-1)?.[0]?.dependencies?.session?.subject).toBe(user.id);
    });
    const dependencies = pushSettingsCard.mock.calls.at(-1)?.[0]?.dependencies;
    if (!dependencies?.session) throw new Error("Authenticated push dependencies were not injected");
    await expect(dependencies.session.getAccessToken()).resolves.toBe("access-token");
  });
});
