import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import type { TokenSession } from "@/lib/api/types";
import { AuthSessionProvider, useAuthSession } from "@/lib/auth/auth-session-provider";

import AuthPage from "./page";

const routerReplace = vi.hoisted(() => vi.fn());
const setNavigationIntent = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
}));

vi.mock("@/components/navigation-intent", () => ({
  setNavigationIntent,
}));

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

function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn().mockResolvedValue({
      requestId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
      expiresAt: "2026-09-07T00:10:00.000Z",
      retryAfterSeconds: 30,
    }),
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
    deleteCurrentSession: vi.fn(),
    putPushDevice: vi.fn(),
    deletePushDevice: vi.fn(),
    ...overrides,
  };
}

function problem(code: string, detail: string) {
  return new ApiProblemError(400, {
    type: `https://bungae.example/problems/${code.toLowerCase()}`,
    title: "인증 요청을 처리할 수 없어요",
    status: 400,
    detail,
    instance: "/v1/auth",
    code,
    traceId: "trace-123",
  });
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

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

function renderAuth(api: BungaeApi) {
  return render(
    <AuthSessionProvider api={api}>
      <AuthPage />
    </AuthSessionProvider>,
  );
}

function requestCode() {
  fireEvent.change(screen.getByRole("textbox", { name: "휴대전화 번호" }), {
    target: { value: "+821012345678" },
  });
  fireEvent.click(screen.getByRole("button", { name: "휴대전화로 시작하기" }));
}

describe("AuthPage", () => {
  beforeEach(() => {
    routerReplace.mockReset();
    setNavigationIntent.mockReset();
    setOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("states the small-group safety scope and adult-only phone start", () => {
    renderAuth(createApi());

    expect(screen.getByRole("heading", { name: "24시간 안에 안전하게 만나는 소규모 모임" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "휴대전화로 시작하기" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "휴대전화 번호" })).toHaveValue("010-");
    expect(screen.getByText("만 18세 이상만 이용할 수 있어요.")).toBeInTheDocument();
    expect(screen.queryByText(/데이트|유료 행사|장기 동호회/)).not.toBeInTheDocument();
  });

  it("requests an OTP, creates the session, and replaces the route after success", async () => {
    const api = createApi();
    renderAuth(api);

    requestCode();
    await screen.findByRole("heading", { name: "인증번호를 입력해 주세요" });
    expect(api.requestOtp).toHaveBeenCalledWith({
      phoneNumber: "+821012345678",
      purpose: "SIGN_UP_OR_LOGIN",
    });
    expect(screen.getByRole("textbox", { name: "인증번호" })).toHaveFocus();

    fireEvent.change(screen.getByRole("textbox", { name: "인증번호" }), {
      target: { value: "123456" },
    });
    fireEvent.submit(screen.getByRole("textbox", { name: "인증번호" }).closest("form")!);

    await waitFor(() => {
      expect(api.createSession).toHaveBeenCalledWith({
        requestId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
        otp: "123456",
      });
      expect(setNavigationIntent).toHaveBeenCalledWith("replace", "/");
      expect(routerReplace).toHaveBeenCalledWith("/");
    });
  });

  it("maps phone request, invalid code, expired code, and generic problems to actionable copy", async () => {
    const api = createApi({
      requestOtp: vi
        .fn()
        .mockRejectedValueOnce(problem("INVALID_PHONE_NUMBER", "ignored"))
        .mockResolvedValueOnce({
          requestId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
          expiresAt: "2026-09-07T00:10:00.000Z",
          retryAfterSeconds: 0,
        }),
      createSession: vi
        .fn()
        .mockRejectedValueOnce(problem("OTP_INVALID", "ignored"))
        .mockRejectedValueOnce(problem("OTP_EXPIRED", "ignored")),
    });
    renderAuth(api);

    requestCode();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "010-으로 시작하는 휴대전화 번호 11자리를 입력해 주세요.",
    );

    requestCode();
    await screen.findByRole("heading", { name: "인증번호를 입력해 주세요" });
    const otpInput = screen.getByRole("textbox", { name: "인증번호" });
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.submit(otpInput.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("인증번호가 맞지 않아요. 다시 확인해 주세요.");

    fireEvent.change(otpInput, { target: { value: "654321" } });
    fireEvent.submit(otpInput.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("인증번호가 만료되었어요. 새 인증번호를 요청해 주세요.");
  });

  it("shows the resend countdown and only enables resend after retryAfterSeconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"));
    const api = createApi({
      requestOtp: vi.fn().mockResolvedValue({
        requestId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
        expiresAt: "2026-09-07T00:10:00.000Z",
        retryAfterSeconds: 3,
      }),
    });
    renderAuth(api);

    await act(async () => {
      requestCode();
    });
    const resend = screen.getByRole("button", { name: "재전송 가능까지 00:03" });
    expect(resend).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("button", { name: "인증번호 다시 받기" })).toBeEnabled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("suppresses duplicate OTP requests and ignores a stale request after the number changes", async () => {
    const pendingChallenge = deferred<{ requestId: string; expiresAt: string; retryAfterSeconds: number }>();
    const api = createApi({ requestOtp: vi.fn().mockReturnValue(pendingChallenge.promise) });
    renderAuth(api);

    requestCode();
    fireEvent.click(screen.getByRole("button", { name: "인증번호 요청 중…" }));
    expect(api.requestOtp).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole("textbox", { name: "휴대전화 번호" }), {
      target: { value: "+821055555555" },
    });
    await act(async () => {
      pendingChallenge.resolve({
        requestId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
        expiresAt: "2026-09-07T00:10:00.000Z",
        retryAfterSeconds: 30,
      });
    });

    expect(screen.getByRole("textbox", { name: "휴대전화 번호" })).toHaveValue("010-5555-5555");
    expect(screen.queryByRole("heading", { name: "인증번호를 입력해 주세요" })).not.toBeInTheDocument();
  });

  it("does not commit a stale verification completion after the code changes", async () => {
    const pendingSession = deferred<TokenSession>();
    const api = createApi({ createSession: vi.fn().mockReturnValue(pendingSession.promise) });
    renderAuth(api);

    requestCode();
    await screen.findByRole("heading", { name: "인증번호를 입력해 주세요" });
    const otpInput = screen.getByRole("textbox", { name: "인증번호" });
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.submit(otpInput.closest("form")!);
    fireEvent.change(otpInput, { target: { value: "654321" } });
    await act(async () => {
      pendingSession.resolve({
        accessToken: "stale-access-token",
        refreshToken: "stale-refresh-token",
        expiresIn: 900,
        user,
      });
    });

    expect(routerReplace).not.toHaveBeenCalled();
    expect(otpInput).toHaveValue("654321");
  });

  it("keeps the number editable from the OTP step", async () => {
    renderAuth(createApi());

    requestCode();
    await screen.findByRole("heading", { name: "인증번호를 입력해 주세요" });
    fireEvent.click(screen.getByRole("button", { name: "번호 수정" }));

    expect(screen.getByRole("textbox", { name: "휴대전화 번호" })).toHaveValue("010-1234-5678");
    expect(screen.getByRole("textbox", { name: "휴대전화 번호" })).toHaveFocus();
  });

  it("reports rate limiting and preserves a general RFC 9457 problem detail", async () => {
    const api = createApi({
      requestOtp: vi
        .fn()
        .mockResolvedValueOnce({
          requestId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
          expiresAt: "2026-09-07T00:10:00.000Z",
          retryAfterSeconds: 0,
        })
        .mockRejectedValueOnce(problem("OTP_RATE_LIMITED", "ignored"))
        .mockRejectedValueOnce(problem("UNAVAILABLE", "서버 점검 중이에요.")),
    });
    renderAuth(api);

    requestCode();
    await screen.findByRole("heading", { name: "인증번호를 입력해 주세요" });
    fireEvent.click(screen.getByRole("button", { name: "인증번호 다시 받기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "요청이 많아요. 잠시 후 다시 인증번호를 요청해 주세요.",
    );

    fireEvent.click(screen.getByRole("button", { name: "인증번호 다시 받기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("서버 점검 중이에요.");
  });

  it("disables OTP submission while the browser reports offline and keeps the draft", async () => {
    const api = createApi();
    renderAuth(api);

    requestCode();
    await screen.findByRole("heading", { name: "인증번호를 입력해 주세요" });
    setOnline(false);
    const otpInput = screen.getByRole("textbox", { name: "인증번호" });
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.submit(otpInput.closest("form")!);

    expect(api.createSession).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "인터넷 연결이 끊겨 인증번호를 확인할 수 없어요",
    );
    expect(otpInput).toHaveValue("123456");
    expect(otpInput).toHaveFocus();
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();

    setOnline(true);
    const submitButton = screen.getByRole("button", { name: "인증하고 시작하기" });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.submit(otpInput.closest("form")!);
    await waitFor(() => expect(api.createSession).toHaveBeenCalledTimes(1));
  });

  it("does not issue an OTP request while offline and keeps the draft", async () => {
    const api = createApi();
    setOnline(false);
    renderAuth(api);

    const phoneForm = screen.getByRole("textbox", { name: "휴대전화 번호" }).closest("form")!;
    fireEvent.change(screen.getByRole("textbox", { name: "휴대전화 번호" }), {
      target: { value: "+821012345678" },
    });
    expect(screen.getByRole("button", { name: "휴대전화로 시작하기" })).toBeDisabled();
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    fireEvent.submit(phoneForm);
    expect(api.requestOtp).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "인터넷 연결이 끊겨 인증번호를 요청할 수 없어요",
    );
    expect(screen.getByRole("textbox", { name: "휴대전화 번호" })).toHaveValue("010-1234-5678");
    expect(screen.getByRole("textbox", { name: "휴대전화 번호" })).toHaveFocus();

    setOnline(true);
    const startButton = screen.getByRole("button", { name: "휴대전화로 시작하기" });
    await waitFor(() => expect(startButton).toBeEnabled());
    fireEvent.submit(phoneForm);
    await screen.findByRole("heading", { name: "인증번호를 입력해 주세요" });
    expect(api.requestOtp).toHaveBeenCalledTimes(1);
  });

  it("returns an already-authenticated visitor to the surface instead of a second OTP", async () => {
    const api = createApi();
    function AuthenticatedAuth() {
      const { createSession } = useAuthSession();
      useEffect(() => {
        void createSession({ requestId: user.id, otp: "123456" });
      }, [createSession]);
      return <AuthPage />;
    }
    render(
      <AuthSessionProvider api={api}>
        <AuthenticatedAuth />
      </AuthSessionProvider>,
    );

    expect(await screen.findByRole("heading", { name: "이미 로그인되어 있어요" })).toBeInTheDocument();
    expect(screen.getByText(/민지님으로 로그인된 상태예요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "탐색으로 돌아가기" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "휴대전화로 시작하기" })).not.toBeInTheDocument();
    expect(api.requestOtp).not.toHaveBeenCalled();
  });
});
