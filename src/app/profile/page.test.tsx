import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import {
  AuthSessionProvider,
  type AuthSessionContextValue,
  useAuthSession,
} from "@/lib/auth/auth-session-provider";
import ProfilePage from "./page";

function renderProfile() {
  return render(
    <AuthSessionProvider>
      <ProfilePage />
    </AuthSessionProvider>,
  );
}

const authenticatedUser = {
  id: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  displayName: "민지",
  ageBand: "25_34" as const,
  bio: "",
  interestCodes: ["walk"],
  homeAreaCode: "MAPO",
  adultVerified: false,
  identityVerified: false,
  version: 4,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const anotherUser = {
  ...authenticatedUser,
  id: "b7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  displayName: "서연",
  homeAreaCode: "SEOUL",
  version: 8,
};

function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn(),
    createSession: vi.fn().mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      user: authenticatedUser,
    }),
    refreshSession: vi.fn(),
    getMe: vi.fn().mockResolvedValue(authenticatedUser),
    updateMe: vi.fn().mockResolvedValue(authenticatedUser),
    getActivityPolicies: vi.fn().mockResolvedValue({
      items: [
        {
          code: "walk",
          name: "산책",
          minimumParticipants: 2,
          maximumParticipants: 4,
          venuePolicy: "PUBLIC",
          timePolicy: "FLEXIBLE",
          alcoholPolicy: "NOT_ALLOWED",
        },
      ],
    }),
    listMeetups: vi.fn(),
    getMeetup: vi.fn(),
    createVerificationSession: vi.fn().mockResolvedValue({
      verificationSessionId: authenticatedUser.id,
      providerUrl: "https://verify.example/session",
      expiresAt: "2026-09-07T00:15:00.000Z",
    }),
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

function AuthenticatedProfile() {
  const { createSession } = useAuthSession();
  useEffect(() => {
    void createSession({ requestId: authenticatedUser.id, otp: "123456" });
  }, [createSession]);
  return <ProfilePage />;
}

function renderAuthenticatedProfile(api: BungaeApi) {
  return render(
    <AuthSessionProvider api={api}>
      <AuthenticatedProfile />
    </AuthSessionProvider>,
  );
}

let latestSession: AuthSessionContextValue;

function SwitchableProfile() {
  latestSession = useAuthSession();
  return <ProfilePage />;
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

function renderSwitchableProfile(api: BungaeApi) {
  return render(
    <AuthSessionProvider api={api}>
      <SwitchableProfile />
    </AuthSessionProvider>,
  );
}

describe("ProfilePage", () => {
  afterEach(() => {
    setOnline(true);
  });

  it("keeps the anonymous profile route behind phone login", () => {
    renderProfile();

    expect(screen.getByRole("heading", { name: "로그인하고 프로필을 확인해 주세요" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "휴대전화로 로그인하기" })).toHaveAttribute("href", "/auth");
    expect(screen.queryByRole("button", { name: "표시 프로필 수정" })).not.toBeInTheDocument();
    expect(screen.queryByText("본인 인증 완료 · 출석 신뢰 안정적")).not.toBeInTheDocument();
  });

  it("requires confirmation before an authenticated user logs out", async () => {
    renderAuthenticatedProfile(createApi());

    await screen.findByRole("heading", { name: "민지" });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(screen.getByRole("dialog", { name: "로그아웃할까요?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });

  it("returns to the login gate after authenticated logout commits", async () => {
    renderAuthenticatedProfile(createApi());

    await screen.findByRole("heading", { name: "민지" });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    fireEvent.click(screen.getByRole("button", { name: /^로그아웃$/ }));

    expect(screen.queryByRole("heading", { name: "로그인하고 프로필을 확인해 주세요" })).not.toBeInTheDocument();
    await screen.findByRole("heading", { name: "로그인하고 프로필을 확인해 주세요" });
    expect(screen.queryByRole("button", { name: "표시 프로필 수정" })).not.toBeInTheDocument();
  });

  it("does not render anonymous fixture fields when a profile query is supplied", () => {
    window.history.replaceState({}, "", "/profile?success=1");
    renderProfile();

    expect(screen.queryByText("산책 · 보드게임 · 카페 대화")).not.toBeInTheDocument();
    expect(screen.queryByText("마포구 망원동")).not.toBeInTheDocument();
  });


  it("loads the authenticated profile and patches only backend-supported fields", async () => {
    const api = createApi();
    renderAuthenticatedProfile(api);

    await screen.findByRole("heading", { name: "민지" });
    expect(screen.getByRole("link", { name: "노쇼 이의" })).toHaveAttribute("href", "/profile/no-show-appeals");
    expect(screen.getByRole("link", { name: "신고 결과" })).toHaveAttribute("href", "/profile/incidents");
    expect(screen.getByRole("link", { name: "계정 탈퇴" })).toHaveAttribute("href", "/profile/withdrawal");
    expect(screen.getByText("산책")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "표시 프로필 수정" }));
    fireEvent.change(screen.getByLabelText("표시 이름"), { target: { value: "서연" } });
    fireEvent.change(screen.getByLabelText("소개"), { target: { value: "주말 산책을 좋아해요." } });
    fireEvent.click(screen.getByRole("checkbox", { name: "산책" }));
    fireEvent.change(screen.getByLabelText("활동 지역 코드"), { target: { value: "SEOUL" } });
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() =>
      expect(api.updateMe).toHaveBeenCalledWith(
        {
          displayName: "서연",
          ageBand: "25_34",
          bio: "주말 산책을 좋아해요.",
          interestCodes: [],
          homeAreaCode: "SEOUL",
        },
        4,
        "access-token",
      ),
    );
    expect(api.updateMe).toHaveBeenCalledWith(
      expect.not.objectContaining({ availability: expect.anything() }),
      4,
      "access-token",
    );
  });

  it("shows a retryable GET failure and replaces the stale draft after a version conflict", async () => {
    const conflict = new ApiProblemError(409, {
      type: "https://bungae.example/problems/profile-version-conflict",
      title: "Profile version conflict",
      status: 409,
      detail: "다른 곳에서 프로필이 변경되었어요.",
      instance: "/v1/me",
      code: "PROFILE_VERSION_CONFLICT",
      traceId: "trace-123",
    });
    const api = createApi({
      getMe: vi
        .fn()
        .mockRejectedValueOnce(new ApiProblemError(503, null))
        .mockResolvedValue(authenticatedUser),
      updateMe: vi.fn().mockRejectedValue(conflict),
    });
    renderAuthenticatedProfile(api);

    expect(await screen.findByRole("alert")).toHaveTextContent("프로필을 불러오지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "프로필 다시 불러오기" }));
    await screen.findByRole("heading", { name: "민지" });
    fireEvent.click(screen.getByRole("button", { name: "표시 프로필 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("다른 곳에서 프로필이 변경되었어요.");
    fireEvent.click(screen.getByRole("button", { name: "최신 프로필 다시 불러오기" }));
    await waitFor(() => expect(api.getMe).toHaveBeenCalledTimes(3));
  });

  it("waits for an explicit user action before navigating to a safe verification provider", async () => {
    const api = createApi();
    const originalHref = window.location.href;
    renderAuthenticatedProfile(api);

    await screen.findByRole("heading", { name: "민지" });
    fireEvent.click(screen.getByRole("button", { name: "인증 시작" }));

    expect(await screen.findByRole("button", { name: "인증 제공자에서 계속하기" })).toBeInTheDocument();
    expect(api.createVerificationSession).toHaveBeenCalledWith("access-token");
    expect(window.location.href).toBe(originalHref);
  });

  it("rejects an unsafe verification provider URL without rendering a navigation control", async () => {
    const api = createApi({
      createVerificationSession: vi.fn().mockResolvedValue({
        verificationSessionId: authenticatedUser.id,
        providerUrl: "http://verify.example/session",
        expiresAt: "2026-09-07T00:15:00.000Z",
      }),
    });
    renderAuthenticatedProfile(api);

    await screen.findByRole("heading", { name: "민지" });
    fireEvent.click(screen.getByRole("button", { name: "인증 시작" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("안전한 HTTPS 인증 주소");
    expect(screen.queryByRole("button", { name: "인증 제공자에서 계속하기" })).not.toBeInTheDocument();
  });

  it("clears a prior account's ready verification URL before the replacement profile renders", async () => {
    const api = createApi({
      createSession: vi.fn(({ requestId }) =>
        Promise.resolve({
          accessToken: requestId === anotherUser.id ? "new-access" : "old-access",
          refreshToken: requestId === anotherUser.id ? "new-refresh" : "old-refresh",
          expiresIn: 900,
          user: requestId === anotherUser.id ? anotherUser : authenticatedUser,
        }),
      ),
      getMe: vi.fn((accessToken: string) =>
        Promise.resolve(accessToken === "new-access" ? anotherUser : authenticatedUser),
      ),
    });
    renderSwitchableProfile(api);

    await act(async () => {
      await latestSession.createSession({ requestId: authenticatedUser.id, otp: "123456" });
    });
    await screen.findByRole("heading", { name: "민지" });
    fireEvent.click(screen.getByRole("button", { name: "인증 시작" }));
    await screen.findByRole("button", { name: "인증 제공자에서 계속하기" });

    await act(async () => {
      await latestSession.createSession({ requestId: anotherUser.id, otp: "654321" });
    });
    await screen.findByRole("heading", { name: "서연" });

    expect(screen.queryByRole("button", { name: "인증 제공자에서 계속하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "인증 시작" })).toBeEnabled();
  });

  it("does not carry an old pending PATCH into a replacement account editor", async () => {
    let resolveOldPatch!: (profile: typeof authenticatedUser) => void;
    const oldPatch = new Promise<typeof authenticatedUser>((resolve) => {
      resolveOldPatch = resolve;
    });
    const api = createApi({
      createSession: vi.fn(({ requestId }) =>
        Promise.resolve({
          accessToken: requestId === anotherUser.id ? "new-access" : "old-access",
          refreshToken: requestId === anotherUser.id ? "new-refresh" : "old-refresh",
          expiresIn: 900,
          user: requestId === anotherUser.id ? anotherUser : authenticatedUser,
        }),
      ),
      getMe: vi.fn((accessToken: string) =>
        Promise.resolve(accessToken === "new-access" ? anotherUser : authenticatedUser),
      ),
      updateMe: vi.fn((_patch, _version, accessToken: string) =>
        accessToken === "old-access" ? oldPatch : Promise.resolve(anotherUser),
      ),
    });
    renderSwitchableProfile(api);

    await act(async () => {
      await latestSession.createSession({ requestId: authenticatedUser.id, otp: "123456" });
    });
    await screen.findByRole("heading", { name: "민지" });
    fireEvent.click(screen.getByRole("button", { name: "표시 프로필 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    expect(screen.getByRole("button", { name: "저장 중" })).toBeDisabled();

    await act(async () => {
      await latestSession.createSession({ requestId: anotherUser.id, otp: "654321" });
    });
    await screen.findByRole("heading", { name: "서연" });
    fireEvent.click(screen.getByRole("button", { name: "표시 프로필 수정" }));
    expect(screen.getByRole("button", { name: "저장하기" })).toBeEnabled();

    await act(async () => {
      resolveOldPatch({ ...authenticatedUser, displayName: "이전 계정" });
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "서연" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장하기" })).toBeEnabled();
  });

  it("drops a late profile load after the same subject logs out and back in", async () => {
    let resolveOld!: (profile: typeof authenticatedUser) => void;
    const oldMe = new Promise<typeof authenticatedUser>((resolve) => {
      resolveOld = resolve;
    });
    const api = createApi({
      getMe: vi.fn().mockReturnValueOnce(oldMe).mockResolvedValue(authenticatedUser),
      getActivityPolicies: vi.fn().mockResolvedValue({ items: [] }),
    });
    renderSwitchableProfile(api);

    await act(async () => {
      await latestSession.createSession({ requestId: authenticatedUser.id, otp: "123456" });
    });
    await waitFor(() => expect(api.getMe).toHaveBeenCalledTimes(1));

    await act(async () => {
      await latestSession.logout();
    });
    await screen.findByRole("heading", { name: "로그인하고 프로필을 확인해 주세요" });

    await act(async () => {
      await latestSession.createSession({ requestId: authenticatedUser.id, otp: "654321" });
    });
    await screen.findByRole("heading", { name: "민지" });
    expect(api.getMe).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveOld(authenticatedUser);
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "민지" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "표시 프로필 수정" })).toBeEnabled();
  });

  it("does not render the old session's logout completion message after re-login", async () => {
    const api = createApi();
    renderSwitchableProfile(api);

    await act(async () => {
      await latestSession.createSession({ requestId: authenticatedUser.id, otp: "123456" });
    });
    await screen.findByRole("heading", { name: "민지" });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    fireEvent.click(screen.getByRole("button", { name: /^로그아웃$/ }));
    await screen.findByRole("heading", { name: "로그인하고 프로필을 확인해 주세요" });

    await act(async () => {
      await latestSession.createSession({ requestId: authenticatedUser.id, otp: "654321" });
    });
    await screen.findByRole("heading", { name: "민지" });
    expect(screen.queryByText("로그아웃 완료")).not.toBeInTheDocument();
    expect(screen.queryByText("다시 로그인하면 모임을 계속 이용할 수 있어요.")).not.toBeInTheDocument();
  });

  it("blocks profile mutation controls while offline and explains why", async () => {
    act(() => setOnline(false));
    const api = createApi();
    renderAuthenticatedProfile(api);

    await screen.findByRole("heading", { name: "민지" });
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "표시 프로필 수정" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "인증 시작" })).toBeDisabled();

    act(() => setOnline(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "표시 프로필 수정" })).toBeEnabled());
  });

  it("does not save an offline profile edit and keeps the draft on reconnect", async () => {
    const api = createApi();
    renderAuthenticatedProfile(api);

    await screen.findByRole("heading", { name: "민지" });
    fireEvent.click(screen.getByRole("button", { name: "표시 프로필 수정" }));
    fireEvent.change(screen.getByLabelText("표시 이름"), { target: { value: "재연결 후 저장" } });

    act(() => setOnline(false));
    const saveForm = screen.getByLabelText("표시 이름").closest("form")!;
    fireEvent.submit(saveForm);
    expect(api.updateMe).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("인터넷 연결이 끊겨 프로필을 저장할 수 없어요");
    expect(screen.getByLabelText("표시 이름")).toHaveValue("재연결 후 저장");

    act(() => setOnline(true));
    const saveButton = screen.getByRole("button", { name: "저장하기" });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.submit(saveForm);
    await waitFor(() => expect(api.updateMe).toHaveBeenCalledTimes(1));
  });
});
