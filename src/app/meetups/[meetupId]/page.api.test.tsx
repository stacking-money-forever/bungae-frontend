import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import type { Meetup } from "@/lib/api/types";
import { AuthSessionProvider, type AuthSessionContextValue, useAuthSession } from "@/lib/auth/auth-session-provider";

import MeetupDetailPage from "./page";

let routeId = "b7c77e71-5b90-42f2-b9e1-8f6c8b1db76c";

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: routeId }),
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

const replacementUser = {
  ...user,
  id: "c7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
};

const meetup: Meetup = {
  id: "b7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  activityCode: "WALK",
  title: "서버 한강 산책",
  description: "서버 설명",
  startsAt: "2026-09-07T09:30:00.000Z",
  endsAt: "2026-09-07T11:00:00.000Z",
  minimumParticipants: 2,
  capacity: 4,
  venue: { name: "망원한강공원 3번 출입구", latitude: 37.5562, longitude: 126.9019, address: "서울특별시 마포구 비공개 12" },
  cost: 0,
  alcoholPolicy: "NOT_ALLOWED" as const,
  state: "OPEN" as const,
  joinedCount: 1,
  version: 1,
  allowedActions: ["JOIN"] as const,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  joinDeadline: "2026-09-07T09:30:00.000Z",
  quorumStatus: "PENDING" as const,
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

function SignedInDetail() {
  const { createSession } = useAuthSession();
  useEffect(() => {
    void createSession({ requestId: user.id, otp: "123456" });
  }, [createSession]);
  return <MeetupDetailPage />;
}

let latestSession: AuthSessionContextValue;

function SwitchableDetail() {
  latestSession = useAuthSession();
  return <MeetupDetailPage />;
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

async function openReportWithReason(label: string) {
  await screen.findByRole("heading", { name: "서버 한강 산책" });
  fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
  fireEvent.click(await screen.findByRole("radio", { name: label }));
}

beforeEach(() => {
  routeId = meetup.id;
});

describe("authenticated meetup detail API", () => {
  it("renders server state, allowed actions, and authorized venue fields when present", async () => {
    const api = createApi();
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    expect(await screen.findByRole("heading", { name: "서버 한강 산책" })).toBeInTheDocument();
    expect(screen.getByText("서버 설명")).toBeInTheDocument();
    expect(screen.getByText("모임 장소")).toBeInTheDocument();
    expect(screen.getByText("망원한강공원 3번 출입구 · 서울특별시 마포구 비공개 12")).toBeInTheDocument();
    expect(screen.queryByText("37.5562")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이 모임에 참여하기" })).toBeEnabled();
    expect(api.getMeetup).toHaveBeenCalledWith(meetup.id, "access");
  });

  it("joins once with an idempotency key, renders waitlist state, and refetches detail", async () => {
    const api = createApi({
      joinMeetup: vi.fn().mockResolvedValue({ participationId: user.id, state: "WAITLISTED", meetupState: "OPEN", joinedCount: 4, capacity: 4, waitlistPosition: 2, quorumStatus: "PENDING" }),
      getMeetup: vi.fn().mockResolvedValue(meetup),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    expect(await screen.findByRole("button", { name: "이 모임에 참여하기" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "이 모임에 참여하기" }));
    expect(await screen.findByText(/대기 목록에 등록됐어요 \(2번째\)/)).toBeInTheDocument();
    expect(api.joinMeetup).toHaveBeenCalledWith(meetup.id, expect.any(String), "access");
    expect(api.getMeetup).toHaveBeenCalledTimes(2);
  });

  it("accepts an empty privacy-redacted detail venue payload without rendering undefined", async () => {
    const api = createApi({
      getMeetup: vi.fn().mockResolvedValue({ ...meetup, venue: {} }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    expect(await screen.findByRole("heading", { name: "서버 한강 산책" })).toBeInTheDocument();
    expect(screen.getByText("공개 장소")).toBeInTheDocument();
    expect(screen.getByText("정확한 장소는 참여 확정 후 공개해요.")).toBeInTheDocument();
    expect(screen.getByText("본인 인증이 된 사람과 만나요")).toBeInTheDocument();
    expect(screen.queryByText("참가자 본인 인증 100%")).not.toBeInTheDocument();
    expect(screen.queryByText(/^undefined$/)).not.toBeInTheDocument();
  });

  it("renders only loading while an authenticated route switch waits for its detail", async () => {
    const replacement = { ...meetup, id: "d7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", title: "새 경로 모임" };
    const replacementResponse = deferred<Meetup>();
    const api = createApi({
      getMeetup: vi.fn((id: string) =>
        id === meetup.id ? Promise.resolve(meetup) : replacementResponse.promise,
      ),
    });
    const rendered = render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    expect(await screen.findByRole("heading", { name: "서버 한강 산책" })).toBeInTheDocument();
    routeId = replacement.id;
    rendered.rerender(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);
    await waitFor(() => expect(api.getMeetup).toHaveBeenCalledWith(replacement.id, "access"));

    expect(screen.getByRole("status")).toHaveTextContent("모임을 불러오는 중이에요");
    expect(screen.queryByRole("heading", { name: "서버 한강 산책" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "퇴근 후 한강 산책" })).not.toBeInTheDocument();

    await act(async () => {
      replacementResponse.resolve(replacement);
      await Promise.resolve();
    });
    expect(await screen.findByRole("heading", { name: "새 경로 모임" })).toBeInTheDocument();
  });

  it("renders only loading while an authenticated account switch waits for its detail", async () => {
    const replacement = { ...meetup, title: "새 계정 모임" };
    const replacementResponse = deferred<Meetup>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) =>
        Promise.resolve({
          accessToken: requestId === replacementUser.id ? "replacement-access" : "access",
          refreshToken: "refresh",
          expiresIn: 900,
          user: requestId === replacementUser.id ? replacementUser : user,
        }),
      ),
      getMeetup: vi.fn().mockResolvedValueOnce(meetup).mockReturnValueOnce(replacementResponse.promise),
    });
    render(<AuthSessionProvider api={api}><SwitchableDetail /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: user.id, otp: "123456" });
    });
    expect(await screen.findByRole("heading", { name: "서버 한강 산책" })).toBeInTheDocument();
    await act(async () => {
      await latestSession.createSession({ requestId: replacementUser.id, otp: "654321" });
    });
    await waitFor(() => expect(api.getMeetup).toHaveBeenCalledTimes(2));

    expect(screen.getByRole("status")).toHaveTextContent("모임을 불러오는 중이에요");
    expect(screen.queryByRole("heading", { name: "서버 한강 산책" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "퇴근 후 한강 산책" })).not.toBeInTheDocument();

    await act(async () => {
      replacementResponse.resolve(replacement);
      await Promise.resolve();
    });
    expect(await screen.findByRole("heading", { name: "새 계정 모임" })).toBeInTheDocument();
  });

  it("clears report local state across authenticated route changes and exposes the proposer-id contract gap", async () => {
    const nextRoute = { ...meetup, id: "d7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", title: "신고 후 새 모임" };
    const nextRouteResponse = deferred<Meetup>();
    const api = createApi({ getMeetup: vi.fn((id: string) => id === meetup.id ? Promise.resolve(meetup) : nextRouteResponse.promise) });
    const rendered = render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);
    expect(await screen.findByRole("heading", { name: "서버 한강 산책" })).toBeInTheDocument();
    expect(screen.getByText("제안자 정보가 없어 여기서 차단할 수 없어요.")).toBeInTheDocument();
    routeId = nextRoute.id;
    rendered.rerender(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);
    await act(async () => { nextRouteResponse.resolve(nextRoute); });
    expect(await screen.findByRole("heading", { name: "신고 후 새 모임" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "제안자 차단" })).not.toBeInTheDocument();
  });

  it("clears an open report dialog and its input across an authenticated account change", async () => {
    const replacement = { ...meetup, title: "새 계정 모임" };
    const replacementResponse = deferred<Meetup>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) =>
        Promise.resolve({
          accessToken: requestId === replacementUser.id ? "replacement-access" : "access",
          refreshToken: "refresh",
          expiresIn: 900,
          user: requestId === replacementUser.id ? replacementUser : user,
        }),
      ),
      getMeetup: vi.fn().mockResolvedValueOnce(meetup).mockReturnValueOnce(replacementResponse.promise),
    });
    render(<AuthSessionProvider api={api}><SwitchableDetail /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: user.id, otp: "123456" });
    });
    expect(await screen.findByRole("heading", { name: "서버 한강 산책" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
    fireEvent.change(screen.getByRole("textbox", { name: "상세 내용 (선택)" }), {
      target: { value: "이전 계정 신고 입력" },
    });
    expect(screen.getByDisplayValue("이전 계정 신고 입력")).toBeInTheDocument();

    await act(async () => {
      await latestSession.createSession({ requestId: replacementUser.id, otp: "654321" });
    });
    await waitFor(() => expect(api.getMeetup).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toHaveTextContent("모임을 불러오는 중이에요");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("이전 계정 신고 입력")).not.toBeInTheDocument();

    await act(async () => {
      replacementResponse.resolve(replacement);
      await Promise.resolve();
    });
    expect(await screen.findByRole("heading", { name: "새 계정 모임" })).toBeInTheDocument();
  });

  it("drops a late route response after the meetup id changes", async () => {
    const oldResponse = deferred<typeof meetup>();
    const replacement = {
      ...meetup,
      id: "d7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
      title: "새 경로 모임",
      allowedActions: [...meetup.allowedActions],
    };
    const api = createApi({
      getMeetup: vi.fn((id: string) =>
        id === meetup.id ? oldResponse.promise : Promise.resolve(replacement),
      ),
    });
    const rendered = render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    await waitFor(() => expect(api.getMeetup).toHaveBeenCalledWith(meetup.id, "access"));
    routeId = replacement.id;
    rendered.rerender(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);
    expect(await screen.findByRole("heading", { name: "새 경로 모임" })).toBeInTheDocument();

    await act(async () => {
      oldResponse.resolve(meetup);
      await Promise.resolve();
    });
    expect(screen.queryByRole("heading", { name: "서버 한강 산책" })).not.toBeInTheDocument();
  });

  it("renders the host action projection without inferring JOIN", async () => {
    const api = createApi({
      getMeetup: vi.fn().mockResolvedValue({
        ...meetup,
        allowedActions: ["LEAVE", "CANCEL", "QUORUM_DECISION"],
      }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    expect(await screen.findByRole("button", { name: "모임 참여 취소하기" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "이 모임에 참여하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "안전을 위해 모임 취소하기" })).toHaveAttribute(
      "href",
      `/meetups/${meetup.id}/safety-cancel`,
    );
    expect(screen.getByRole("link", { name: "인원 결정하기" })).toHaveAttribute(
      "href",
      `/meetups/${meetup.id}/quorum-decision`,
    );
    expect(screen.queryByRole("link", { name: "체크인하기" })).not.toBeInTheDocument();
  });

  it("renders CHECK_IN only for a confirmed joined participant", async () => {
    const api = createApi({
      getMeetup: vi.fn().mockResolvedValue({
        ...meetup,
        state: "CONFIRMED",
        allowedActions: ["CHECK_IN"],
      }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    expect(await screen.findByRole("link", { name: "체크인하기" })).toHaveAttribute(
      "href",
      `/meetups/${meetup.id}/check-in`,
    );
    expect(screen.queryByRole("button", { name: "이 모임에 참여하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "모임 참여 취소하기" })).not.toBeInTheDocument();
  });

  it("renders LEAVE only for a waitlisted participant", async () => {
    const api = createApi({
      getMeetup: vi.fn().mockResolvedValue({
        ...meetup,
        allowedActions: ["LEAVE"],
      }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    expect(await screen.findByRole("button", { name: "모임 참여 취소하기" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "이 모임에 참여하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "체크인하기" })).not.toBeInTheDocument();
  });

  it("renders no server actions for an empty detail projection", async () => {
    const api = createApi({
      getMeetup: vi.fn().mockResolvedValue({ ...meetup, allowedActions: [] }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    expect(await screen.findByRole("heading", { name: "서버 한강 산책" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이 모임에 참여하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "모임 참여 취소하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "안전을 위해 모임 취소하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "인원 결정하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "체크인하기" })).not.toBeInTheDocument();
  });

  it("refreshes detail after a JOIN error and retries with the same idempotency key", async () => {
    const api = createApi({
      joinMeetup: vi.fn()
        .mockRejectedValueOnce(new Error("join failed"))
        .mockResolvedValueOnce({
          participationId: user.id,
          state: "JOINED",
          meetupState: "OPEN",
          joinedCount: 2,
          capacity: 4,
          quorumStatus: "PENDING",
        }),
      getMeetup: vi.fn().mockResolvedValue({ ...meetup, allowedActions: ["JOIN"] }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "이 모임에 참여하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("참여를 처리하지 못했어요.");
    await waitFor(() => expect(api.getMeetup).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "같은 요청으로 다시 시도" }));

    await waitFor(() => expect(api.joinMeetup).toHaveBeenCalledTimes(2));
    expect(api.joinMeetup).toHaveBeenNthCalledWith(1, meetup.id, expect.any(String), "access");
    expect(api.joinMeetup).toHaveBeenNthCalledWith(
      2,
      meetup.id,
      (api.joinMeetup as ReturnType<typeof vi.fn>).mock.calls[0][1],
      "access",
    );
    await waitFor(() => expect(api.getMeetup).toHaveBeenCalledTimes(3));
  });

  it("refreshes detail after a successful LEAVE without claiming an optimistic state", async () => {
    const api = createApi({
      leaveMeetup: vi.fn().mockResolvedValue(undefined),
      getMeetup: vi.fn()
        .mockResolvedValueOnce({ ...meetup, allowedActions: ["LEAVE"] })
        .mockResolvedValueOnce({ ...meetup, allowedActions: [] }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "모임 참여 취소하기" }));

    expect(await screen.findByText("참여를 취소했어요. 서버 상태를 새로 확인했어요.")).toBeInTheDocument();
    expect(api.leaveMeetup).toHaveBeenCalledWith(meetup.id, "access");
    expect(api.getMeetup).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "모임 참여 취소하기" })).not.toBeInTheDocument();
  });

  it("refreshes detail after a LEAVE error and permits a retry", async () => {
    const api = createApi({
      leaveMeetup: vi.fn().mockRejectedValueOnce(new Error("leave failed")).mockResolvedValueOnce(undefined),
      getMeetup: vi.fn().mockResolvedValue({ ...meetup, allowedActions: ["LEAVE"] }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "모임 참여 취소하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("참여 취소를 처리하지 못했어요.");
    await waitFor(() => expect(api.getMeetup).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "참여 취소 다시 시도" }));

    await waitFor(() => expect(api.leaveMeetup).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.getMeetup).toHaveBeenCalledTimes(3));
  });

  it("blocks duplicate LEAVE requests while the first request is in flight", async () => {
    const leaveResponse = deferred<void>();
    const api = createApi({
      leaveMeetup: vi.fn().mockReturnValue(leaveResponse.promise),
      getMeetup: vi.fn().mockResolvedValue({ ...meetup, allowedActions: ["LEAVE"] }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    const leave = await screen.findByRole("button", { name: "모임 참여 취소하기" });
    fireEvent.click(leave);
    fireEvent.click(leave);

    await waitFor(() => expect(api.leaveMeetup).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "참여 취소 처리 중…" })).toBeDisabled();
  });

  it("drops a late LEAVE completion after a route change", async () => {
    const leaveResponse = deferred<void>();
    const initial: Meetup = { ...meetup, allowedActions: ["LEAVE"] };
    const replacement: Meetup = {
      ...meetup,
      id: "d7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
      title: "새 경로 모임",
      allowedActions: ["CHECK_IN"],
    };
    const api = createApi({
      leaveMeetup: vi.fn().mockReturnValue(leaveResponse.promise),
      getMeetup: vi.fn((id: string) => id === meetup.id
        ? Promise.resolve(initial)
        : Promise.resolve(replacement)),
    });
    const rendered = render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "모임 참여 취소하기" }));
    routeId = replacement.id;
    rendered.rerender(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);
    expect(await screen.findByRole("heading", { name: "새 경로 모임" })).toBeInTheDocument();

    await act(async () => {
      leaveResponse.resolve(undefined);
      await Promise.resolve();
    });
    expect(screen.queryByText("참여를 취소했어요. 서버 상태를 새로 확인했어요.")).not.toBeInTheDocument();
    expect(api.getMeetup).toHaveBeenCalledTimes(2);
  });

  it("drops a late LEAVE completion after an account change", async () => {
    const leaveResponse = deferred<void>();
    const replacement = { ...meetup, title: "새 계정 모임", allowedActions: ["CHECK_IN"] as const };
    const api = createApi({
      createSession: vi.fn(({ requestId }) =>
        Promise.resolve({
          accessToken: requestId === replacementUser.id ? "replacement-access" : "access",
          refreshToken: "refresh",
          expiresIn: 900,
          user: requestId === replacementUser.id ? replacementUser : user,
        }),
      ),
      leaveMeetup: vi.fn().mockReturnValue(leaveResponse.promise),
      getMeetup: vi.fn()
        .mockResolvedValueOnce({ ...meetup, allowedActions: ["LEAVE"] })
        .mockResolvedValueOnce(replacement),
    });
    render(<AuthSessionProvider api={api}><SwitchableDetail /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: user.id, otp: "123456" });
    });
    fireEvent.click(await screen.findByRole("button", { name: "모임 참여 취소하기" }));
    await act(async () => {
      await latestSession.createSession({ requestId: replacementUser.id, otp: "654321" });
    });
    expect(await screen.findByRole("heading", { name: "새 계정 모임" })).toBeInTheDocument();

    await act(async () => {
      leaveResponse.resolve(undefined);
      await Promise.resolve();
    });
    expect(screen.queryByText("참여를 취소했어요. 서버 상태를 새로 확인했어요.")).not.toBeInTheDocument();
    expect(api.getMeetup).toHaveBeenCalledTimes(2);
  });

  it("encodes action links from the current route id", async () => {
    routeId = "id/with space";
    const api = createApi({
      getMeetup: vi.fn().mockResolvedValue({
        ...meetup,
        id: routeId,
        allowedActions: ["CANCEL", "QUORUM_DECISION", "CHECK_IN"],
      }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    expect(await screen.findByRole("link", { name: "안전을 위해 모임 취소하기" })).toHaveAttribute(
      "href",
      "/meetups/id%2Fwith%20space/safety-cancel",
    );
    expect(screen.getByRole("link", { name: "인원 결정하기" })).toHaveAttribute(
      "href",
      "/meetups/id%2Fwith%20space/quorum-decision",
    );
    expect(screen.getByRole("link", { name: "체크인하기" })).toHaveAttribute(
      "href",
      "/meetups/id%2Fwith%20space/check-in",
    );
  });
  it.each([
    ["괴롭힘·혐오", "HARASSMENT", "괴롭힘·혐오"],
    ["안전 위협", "SAFETY", "안전 위협"],
    ["영업·종교·다단계 권유", "FRAUD", "영업·종교·다단계 권유"],
    ["기타", "OTHER", "기타"],
  ] as const)("submits %s as the exact %s meetup report contract", async (label, category, details) => {
    const api = createApi({
      createReport: vi.fn().mockResolvedValue({
        incidentId: "incident-1",
        state: "RECEIVED",
        priority: "P1",
        submittedAt: "2026-09-07T00:00:00Z",
      }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    await openReportWithReason(label);
    fireEvent.click(screen.getByRole("button", { name: "신고 내용 기록하기" }));

    await waitFor(() => expect(api.createReport).toHaveBeenCalledWith({
      targetType: "MEETUP",
      meetupId: meetup.id,
      category,
      urgency: "P1",
      details,
      evidenceUploadIds: [],
    }, expect.any(String), "access"));
  });

  it("submits urgent reports at P0 with the current custom detail", async () => {
    const api = createApi({
      createReport: vi.fn().mockResolvedValue({
        incidentId: "incident-1",
        state: "RECEIVED",
        priority: "P0",
        submittedAt: "2026-09-07T00:00:00Z",
      }),
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    await openReportWithReason("안전 위협");
    fireEvent.click(screen.getByRole("checkbox", { name: "긴급한 안전 위협이에요" }));
    fireEvent.change(screen.getByRole("textbox", { name: "상세 내용 (선택)" }), { target: { value: "지금 위험해요." } });
    fireEvent.click(screen.getByRole("button", { name: "신고 내용 기록하기" }));

    await waitFor(() => expect(api.createReport).toHaveBeenCalledWith({
      targetType: "MEETUP",
      meetupId: meetup.id,
      category: "SAFETY",
      urgency: "P0",
      details: "지금 위험해요.",
      evidenceUploadIds: [],
    }, expect.any(String), "access"));
  });

  it("blocks duplicate pending reports, keeps the retry key, and rotates it for changed payloads", async () => {
    const apiProblem = new ApiProblemError(422, {
      type: "https://bungae.example/problems/report-invalid",
      title: "Report invalid",
      status: 422,
      detail: "신고 상세를 확인해 주세요.",
      instance: "/v1/reports",
      code: "REPORT_INVALID",
      traceId: "trace-1",
    });
    const firstResponse = deferred<{
      incidentId: string;
      state: "RECEIVED";
      priority: "P1";
      submittedAt: string;
    }>();
    const createReport = vi.fn()
      .mockReturnValueOnce(firstResponse.promise)
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(apiProblem)
      .mockResolvedValueOnce({
        incidentId: "incident-1",
        state: "RECEIVED",
        priority: "P0",
        submittedAt: "2026-09-07T00:00:00Z",
      });
    const api = createApi({ createReport });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    await openReportWithReason("안전 위협");
    const submit = screen.getByRole("button", { name: "신고 내용 기록하기" });
    fireEvent.click(submit);
    await waitFor(() => expect(createReport).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "신고 접수 중…" }));
    expect(createReport).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("신고 내용을 이 화면에 기록했어요. 운영 검토 결과가 확정된 것은 아니에요.")).not.toBeInTheDocument();

    await act(async () => {
      firstResponse.reject(new Error("offline"));
      await Promise.resolve();
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("신고를 접수하지 못했어요.");
    fireEvent.click(screen.getByRole("button", { name: "신고 내용 기록하기" }));
    await waitFor(() => expect(createReport).toHaveBeenCalledTimes(2));
    expect(createReport.mock.calls[1][1]).toBe(createReport.mock.calls[0][1]);

    fireEvent.change(screen.getByRole("textbox", { name: "상세 내용 (선택)" }), { target: { value: "새 상세" } });
    fireEvent.click(screen.getByRole("button", { name: "신고 내용 기록하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("신고 상세를 확인해 주세요.");
    expect(createReport.mock.calls[2][1]).not.toBe(createReport.mock.calls[1][1]);

    fireEvent.click(screen.getByRole("checkbox", { name: "긴급한 안전 위협이에요" }));
    fireEvent.click(screen.getByRole("button", { name: "신고 내용 기록하기" }));
    await waitFor(() => expect(createReport).toHaveBeenCalledTimes(4));
    expect(createReport.mock.calls[3][1]).not.toBe(createReport.mock.calls[2][1]);
  });

  it("drops a late report success after the route changes", async () => {
    const reportResponse = deferred<{
      incidentId: string;
      state: "RECEIVED";
      priority: "P1";
      submittedAt: string;
    }>();
    const nextRoute = { ...meetup, id: "d7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", title: "새 경로 모임" };
    const api = createApi({
      createReport: vi.fn().mockReturnValue(reportResponse.promise),
      getMeetup: vi.fn((id: string) => Promise.resolve(id === meetup.id ? meetup : nextRoute)),
    });
    const rendered = render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);

    await openReportWithReason("안전 위협");
    fireEvent.click(screen.getByRole("button", { name: "신고 내용 기록하기" }));
    routeId = nextRoute.id;
    rendered.rerender(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);
    expect(await screen.findByRole("heading", { name: "새 경로 모임" })).toBeInTheDocument();

    await act(async () => {
      reportResponse.resolve({
        incidentId: "incident-1",
        state: "RECEIVED",
        priority: "P1",
        submittedAt: "2026-09-07T00:00:00Z",
      });
    });
    expect(screen.queryByText("신고 내용을 이 화면에 기록했어요. 운영 검토 결과가 확정된 것은 아니에요.")).not.toBeInTheDocument();
  });

  it("drops a late report error after the account changes", async () => {
    const reportResponse = deferred<{
      incidentId: string;
      state: "RECEIVED";
      priority: "P1";
      submittedAt: string;
    }>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) =>
        Promise.resolve({
          accessToken: requestId === replacementUser.id ? "replacement-access" : "access",
          refreshToken: "refresh",
          expiresIn: 900,
          user: requestId === replacementUser.id ? replacementUser : user,
        })),
      createReport: vi.fn().mockReturnValue(reportResponse.promise),
      getMeetup: vi.fn().mockResolvedValue(meetup),
    });
    render(<AuthSessionProvider api={api}><SwitchableDetail /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: user.id, otp: "123456" });
    });
    await openReportWithReason("안전 위협");
    fireEvent.click(screen.getByRole("button", { name: "신고 내용 기록하기" }));
    await act(async () => {
      await latestSession.createSession({ requestId: replacementUser.id, otp: "654321" });
    });
    await act(async () => {
      reportResponse.reject(new Error("old account failure"));
    });
    expect(screen.queryByText("신고를 접수하지 못했어요.")).not.toBeInTheDocument();
    expect(screen.queryByText("신고 내용을 이 화면에 기록했어요. 운영 검토 결과가 확정된 것은 아니에요.")).not.toBeInTheDocument();
  });

  it("drops a late report success after the same subject logs out and back in", async () => {
    const reportResponse = deferred<{
      incidentId: string;
      state: "RECEIVED";
      priority: "P1";
      submittedAt: string;
    }>();
    const api = createApi({
      createSession: vi.fn(() => Promise.resolve({
        accessToken: "access", refreshToken: "refresh", expiresIn: 900, user,
      })),
      getMeetup: vi.fn().mockResolvedValue(meetup),
      createReport: vi.fn().mockReturnValue(reportResponse.promise),
    });
    render(<AuthSessionProvider api={api}><SwitchableDetail /></AuthSessionProvider>);
    await act(async () => {
      await latestSession.createSession({ requestId: user.id, otp: "123456" });
    });
    await openReportWithReason("안전 위협");
    fireEvent.click(screen.getByRole("button", { name: "신고 내용 기록하기" }));

    await act(async () => {
      await latestSession.logout();
    });
    await screen.findByRole("heading", { name: "로그인하고 모임을 확인해 주세요" });
    await act(async () => {
      await latestSession.createSession({ requestId: user.id, otp: "654321" });
    });
    await screen.findByRole("heading", { name: "서버 한강 산책" });

    await act(async () => {
      reportResponse.resolve({
        incidentId: "incident-1",
        state: "RECEIVED",
        priority: "P1",
        submittedAt: "2026-09-07T00:00:00Z",
      });
    });
    expect(screen.queryByText("신고 내용을 이 화면에 기록했어요. 운영 검토 결과가 확정된 것은 아니에요.")).not.toBeInTheDocument();
  });

  it("blocks an offline report submit, join, and leave without a mutation", async () => {
    const createReport = vi.fn();
    const joinMeetup = vi.fn();
    const leaveMeetup = vi.fn();
    const api = createApi({
      getMeetup: vi.fn().mockResolvedValue({ ...meetup, allowedActions: ["JOIN", "LEAVE"] as const }),
      createReport,
      joinMeetup,
      leaveMeetup,
    });
    render(<AuthSessionProvider api={api}><SignedInDetail /></AuthSessionProvider>);
    await screen.findByRole("heading", { name: "서버 한강 산책" });

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이 모임에 참여하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "모임 참여 취소하기" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "이 모임에 참여하기" }));
    expect(joinMeetup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
    const dialogSubmit = await screen.findByRole("button", { name: "신고 내용 기록하기" });
    expect(dialogSubmit).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "안전 위협" }));
    expect(dialogSubmit).toBeDisabled();
    fireEvent.click(dialogSubmit);
    expect(createReport).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    act(() => setOnline(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "이 모임에 참여하기" })).toBeEnabled());
    expect(createReport).not.toHaveBeenCalled();
    expect(joinMeetup).not.toHaveBeenCalled();
    expect(leaveMeetup).not.toHaveBeenCalled();
  });
});

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}
