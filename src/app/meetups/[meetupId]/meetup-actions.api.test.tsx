import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import type { Meetup } from "@/lib/api/types";
import { AuthSessionProvider, useAuthSession } from "@/lib/auth/auth-session-provider";

import CheckInPage from "./check-in/page";
import QuorumDecisionPage from "./quorum-decision/page";
import SafetyCancelPage from "./safety-cancel/page";

let routeMeetupId = "demo";

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: routeMeetupId }),
  useRouter: () => ({ push: vi.fn() }),
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
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const meetup: Meetup = {
  id: "demo",
  activityCode: "WALK",
  title: "서버 한강 산책",
  startsAt: "2026-09-07T09:30:00.000Z",
  endsAt: "2026-09-07T11:00:00.000Z",
  minimumParticipants: 2,
  capacity: 4,
  venue: {},
  cost: 0,
  alcoholPolicy: "NOT_ALLOWED",
  state: "OPEN",
  joinedCount: 2,
  version: 1,
  allowedActions: [],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  joinDeadline: "2026-09-07T09:00:00.000Z",
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

function SignedIn({ children }: { children: ReactNode }) {
  const { createSession } = useAuthSession();
  useEffect(() => { void createSession({ requestId: user.id, otp: "123456" }); }, [createSession]);
  return <>{children}</>;
}

function renderAuthenticated(page: ReactNode, api: BungaeApi) {
  return render(<AuthSessionProvider api={api}><SignedIn>{page}</SignedIn></AuthSessionProvider>);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

describe("meetup action pages", () => {
  beforeEach(() => {
    routeMeetupId = "demo";
    vi.restoreAllMocks();
  });

  it("denies direct routes without an authenticated allowed action", async () => {
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue({ ...meetup, allowedActions: [] }) });
    renderAuthenticated(<SafetyCancelPage />, api);

    await waitFor(() => expect(screen.getByText("현재 이 모임을 취소할 수 없어요.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "안전 사유로 모임 취소하기" })).toBeDisabled();
    expect(api.cancelMeetup).not.toHaveBeenCalled();
  });

  it("submits a safety cancellation only once in flight and shows receipt after the response", async () => {
    const response = deferred<Meetup>();
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue({ ...meetup, allowedActions: ["CANCEL"] }), cancelMeetup: vi.fn().mockReturnValue(response.promise) });
    renderAuthenticated(<SafetyCancelPage />, api);

    const reason = await screen.findByLabelText("안전 취소 사유");
    fireEvent.change(reason, { target: { value: "안전 우려" } });
    const submit = screen.getByRole("button", { name: "안전 사유로 모임 취소하기" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(api.cancelMeetup).toHaveBeenCalledTimes(1));
    expect(api.cancelMeetup).toHaveBeenCalledWith("demo", { reason: "안전 우려" }, expect.any(String), "access");
    expect(screen.queryByRole("heading", { name: "취소 접수됐어요" })).not.toBeInTheDocument();

    await act(async () => { response.resolve({ ...meetup, state: "CANCELLED" }); });
    expect(await screen.findByRole("heading", { name: "취소 접수됐어요" })).toBeInTheDocument();
  });

  it("reuses a failed cancellation key for the same reason and rolls it over for an edited reason", async () => {
    const cancelMeetup = vi.fn().mockRejectedValueOnce(new ApiProblemError(503, null)).mockRejectedValueOnce(new ApiProblemError(503, null)).mockResolvedValue({ ...meetup, state: "CANCELLED" });
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("same-key").mockReturnValueOnce("new-key");
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue({ ...meetup, allowedActions: ["CANCEL"] }), cancelMeetup });
    renderAuthenticated(<SafetyCancelPage />, api);

    fireEvent.change(await screen.findByLabelText("안전 취소 사유"), { target: { value: "첫 사유" } });
    fireEvent.click(screen.getByRole("button", { name: "안전 사유로 모임 취소하기" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "안전 사유로 모임 취소하기" }));
    await waitFor(() => expect(cancelMeetup).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText("안전 취소 사유"), { target: { value: "변경 사유" } });
    fireEvent.click(screen.getByRole("button", { name: "안전 사유로 모임 취소하기" }));
    await waitFor(() => expect(cancelMeetup).toHaveBeenCalledTimes(3));
    expect(cancelMeetup.mock.calls.map((call) => call[2])).toEqual(["same-key", "same-key", "new-key"]);
  });

  it("sends only the backend-supported check-in method and ignores a stale route completion", async () => {
    const response = deferred<{ participationId: string; state: "CHECKED_IN"; checkedInAt: string }>();
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue({ ...meetup, allowedActions: ["CHECK_IN"] }), checkInMeetup: vi.fn().mockReturnValue(response.promise) });
    const view = renderAuthenticated(<CheckInPage />, api);

    fireEvent.change(await screen.findByLabelText("모임 코드"), { target: { value: "MANGO 27" } });
    const submit = screen.getByRole("button", { name: "코드로 체크인하기" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(api.checkInMeetup).toHaveBeenCalledWith("demo", { method: "MEETUP_CODE", code: "MANGO 27" }, expect.any(String), "access"));
    routeMeetupId = "replacement";
    view.rerender(<AuthSessionProvider api={api}><SignedIn><CheckInPage /></SignedIn></AuthSessionProvider>);
    await act(async () => { response.resolve({ participationId: "participant", state: "CHECKED_IN", checkedInAt: "2026-09-07T10:00:00.000Z" }); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "체크인됐어요" })).not.toBeInTheDocument());
  });

  it("refreshes fresh detail after quorum version conflict and retries with its new version", async () => {
    const decideQuorum = vi.fn().mockRejectedValueOnce(new ApiProblemError(409, null)).mockResolvedValueOnce({ meetupId: "demo", state: "CONFIRMED", quorumDecision: "PROCEED", joinedCount: 2, decidedAt: "2026-09-07T10:00:00.000Z", version: 2, quorumStatus: "PROCEED" });
    const api = createApi({ getMeetup: vi.fn().mockResolvedValueOnce({ ...meetup, allowedActions: ["QUORUM_DECISION"], version: 1 }).mockResolvedValueOnce({ ...meetup, allowedActions: ["QUORUM_DECISION"], version: 2 }), decideQuorum });
    renderAuthenticated(<QuorumDecisionPage />, api);

    fireEvent.click(await screen.findByRole("button", { name: "현재 인원으로 진행하기" }));
    fireEvent.click(screen.getByRole("button", { name: "진행하기" }));
    await waitFor(() => expect(decideQuorum).toHaveBeenCalledWith("demo", "PROCEED", 1, expect.any(String), "access"));
    expect(await screen.findByText("최신 모임 정보를 다시 불러왔어요. 내용을 확인한 뒤 다시 결정해 주세요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "현재 인원으로 진행하기" }));
    fireEvent.click(screen.getByRole("button", { name: "진행하기" }));
    await screen.findByRole("heading", { name: "모임을 진행하기로 했어요" });
    expect(decideQuorum).toHaveBeenLastCalledWith("demo", "PROCEED", 2, expect.any(String), "access");
  });
});
