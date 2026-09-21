import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import type { BungaeApi } from "@/lib/api/client";
import type { Meetup } from "@/lib/api/types";
import { AuthSessionProvider, useAuthSession } from "@/lib/auth/auth-session-provider";

import MeetupDetailPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: "demo" }),
}));

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
  id: "demo",
  activityCode: "WALK",
  title: "서버 한강 산책",
  description: "서버 설명",
  startsAt: "2026-09-07T09:30:00.000Z",
  endsAt: "2026-09-07T11:00:00.000Z",
  minimumParticipants: 2,
  capacity: 4,
  venue: {},
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

function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn(),
    createSession: vi.fn().mockResolvedValue({ accessToken: "access", refreshToken: "refresh", expiresIn: 900, user }),
    refreshSession: vi.fn(),
    getMe: vi.fn(),
    updateMe: vi.fn(),
    getActivityPolicies: vi.fn(),
    createVerificationSession: vi.fn(),
    listMeetups: vi.fn(),
    getMeetup: vi.fn().mockResolvedValue(meetup),
    createMeetup: vi.fn(),
    joinMeetup: vi.fn(),
    leaveMeetup: vi.fn(),
    cancelMeetup: vi.fn(),
    decideQuorum: vi.fn(),
    checkInMeetup: vi.fn(),
    listMyMeetups: vi.fn().mockResolvedValue({ items: [] }),
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

function SignedInDetail() {
  const { createSession } = useAuthSession();

  useEffect(() => {
    void createSession({ requestId: user.id, otp: "123456" });
  }, [createSession]);

  return <MeetupDetailPage />;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function openReportWithReason(label: string) {
  await screen.findByRole("heading", { name: "서버 한강 산책" });
  fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
  fireEvent.click(await screen.findByRole("radio", { name: label }));
}

describe("MeetupDetailPage report safety actions", () => {
  it("opens the authenticated report dialog and restores its trigger after Escape and cancel", async () => {
    const api = createApi();
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    await screen.findByRole("heading", { name: "서버 한강 산책" });
    const reportTrigger = screen.getByRole("button", { name: "신고하기" });
    fireEvent.click(reportTrigger);
    await waitFor(() => expect(screen.getByRole("radio", { name: "안전 위협" })).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(reportTrigger).toHaveFocus();
    });

    fireEvent.click(reportTrigger);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(reportTrigger).toHaveFocus();
    });
  });

  it("shows no receipt before the 202 report response and focuses it after success", async () => {
    const receipt = deferred<{ incidentId: string; state: "RECEIVED"; priority: "P1"; submittedAt: string }>();
    const api = createApi({ createReport: vi.fn().mockReturnValue(receipt.promise) });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    await openReportWithReason("안전 위협");
    fireEvent.click(screen.getByRole("button", { name: "신고 내용 기록하기" }));
    expect(screen.queryByText("신고 내용을 이 화면에 기록했어요. 운영 검토 결과가 확정된 것은 아니에요.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "신고 접수 중…" })).toBeDisabled();

    await act(async () => {
      receipt.resolve({ incidentId: "incident-1", state: "RECEIVED", priority: "P1", submittedAt: "2026-09-07T00:00:00Z" });
    });
    await waitFor(() => {
      const reportReceipt = screen.getByRole("status");
      expect(reportReceipt).toHaveTextContent("신고 내용을 이 화면에 기록했어요. 운영 검토 결과가 확정된 것은 아니에요.");
      expect(reportReceipt).toHaveFocus();
    });
    expect(api.createReport).toHaveBeenCalledWith({
      targetType: "MEETUP",
      meetupId: "demo",
      category: "SAFETY",
      urgency: "P1",
      details: "안전 위협",
      evidenceUploadIds: [],
    }, expect.any(String), "access");
  });
});
