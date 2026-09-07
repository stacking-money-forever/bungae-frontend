"use client";

import { ArrowLeft, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { NavigationLink } from "@/components/navigation-link";
import { OfflineNotice } from "@/components/offline-notice";
import { setNavigationIntent } from "@/components/navigation-intent";
import { ScreenShell } from "@/components/screen-shell";
import { ApiProblemError } from "@/lib/api/client";
import { useAuthSession } from "@/lib/auth/auth-session-provider";
import { useOnlineStatus } from "@/lib/ui/online";

const phoneNumberPattern = /^\+[1-9][0-9]{7,14}$/;
const otpPattern = /^[0-9]{6}$/;

type AuthPhase = "phone" | "otp";

function messageForProblem(error: unknown): string {
  if (!(error instanceof ApiProblemError)) {
    return "지금 인증을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  switch (error.problem?.code) {
    case "INVALID_PHONE_NUMBER":
      return "국가 코드를 포함한 올바른 휴대전화 번호를 입력해 주세요.";
    case "OTP_RATE_LIMITED":
      return "요청이 많아요. 잠시 후 다시 인증번호를 요청해 주세요.";
    case "OTP_INVALID":
      return "인증번호가 맞지 않아요. 다시 확인해 주세요.";
    case "OTP_EXPIRED":
      return "인증번호가 만료되었어요. 새 인증번호를 요청해 주세요.";
    default:
      return error.problem?.detail || "인증을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
}

export default function AuthPage() {
  const router = useRouter();
  const auth = useAuthSession();
  const { requestOtp, createSession, snapshot } = auth;
  const online = useOnlineStatus();
  const [phase, setPhase] = useState<AuthPhase>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<{ requestId: string; expiresAt: string } | null>(null);
  const [retryAvailableAt, setRetryAvailableAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [requestError, setRequestError] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const requestAttemptRef = useRef(0);
  const verificationAttemptRef = useRef(0);
  const challengeVersionRef = useRef(0);
  const requestPendingRef = useRef(false);
  const verificationPendingRef = useRef(false);

  useEffect(() => {
    if (phase === "phone") {
      phoneInputRef.current?.focus();
    } else {
      otpInputRef.current?.focus();
    }
  }, [challenge?.requestId, phase]);

  useEffect(() => {
    if (retryAvailableAt === null) return;

    let interval: number | null = null;
    const updateNow = () => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (interval !== null && nextNow >= retryAvailableAt) {
        window.clearInterval(interval);
        interval = null;
      }
    };

    if (Date.now() < retryAvailableAt) {
      interval = window.setInterval(updateNow, 1000);
    }
    updateNow();
    return () => {
      if (interval !== null) window.clearInterval(interval);
    };
  }, [retryAvailableAt]);

  const retryAfterSeconds = retryAvailableAt === null
    ? 0
    : Math.max(0, Math.ceil((retryAvailableAt - now) / 1000));
  const isBusy = isRequesting || isVerifying;

  if (snapshot.status === "authenticated") {
    // An authenticated visitor reached /auth again (direct URL or after a
    // completed login elsewhere). Do not let them re-enter an OTP challenge;
    // send them to the home surface that renders their real session state.
    return (
      <ScreenShell className="px-5 pb-[max(var(--dimension-x6),env(safe-area-inset-bottom))] pt-[max(var(--dimension-x5),env(safe-area-inset-top))]" aria-labelledby="auth-heading">
        <section className="flex flex-1 flex-col pt-12" role="status">
          <p className="font-display mb-2 text-[length:var(--type-wordmark)] leading-6 text-[var(--fg-neutral)]">벙개</p>
          <h1 id="auth-heading" className="font-display m-0 max-w-[16ch] text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
            이미 로그인되어 있어요
          </h1>
          <p className="m-0 mt-4 max-w-[29ch] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            {snapshot.user.displayName}님으로 로그인된 상태예요. 로그아웃하려면 프로필에서 할 수 있어요.
          </p>
          <Link
            href="/"
            className="mt-auto inline-flex min-h-[var(--action-primary-height)] items-center justify-center rounded-xl bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          >
            탐색으로 돌아가기
          </Link>
        </section>
      </ScreenShell>
    );
  }

  const requestChallenge = async () => {
    if (requestPendingRef.current || verificationPendingRef.current) return;
    if (!online) {
      setRequestError("인터넷 연결이 끊겨 인증번호를 요청할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요.");
      phoneInputRef.current?.focus();
      return;
    }
    if (!phoneNumberPattern.test(phoneNumber)) {
      setRequestError("국가 코드를 포함한 올바른 휴대전화 번호를 입력해 주세요.");
      phoneInputRef.current?.focus();
      return;
    }

    const attempt = ++requestAttemptRef.current;
    requestPendingRef.current = true;
    setIsRequesting(true);
    setRequestError(null);
    setVerificationError(null);
    setStatusMessage("인증번호를 요청하고 있어요.");
    try {
      const nextChallenge = await requestOtp({
        phoneNumber,
        purpose: "SIGN_UP_OR_LOGIN",
      });
      if (requestAttemptRef.current !== attempt) return;

      challengeVersionRef.current += 1;
      setChallenge({ requestId: nextChallenge.requestId, expiresAt: nextChallenge.expiresAt });
      setOtp("");
      setRetryAvailableAt(Date.now() + nextChallenge.retryAfterSeconds * 1000);
      setPhase("otp");
      setStatusMessage("인증번호를 보냈어요.");
    } catch (error) {
      if (requestAttemptRef.current !== attempt) return;
      setRequestError(messageForProblem(error));
      setStatusMessage("");
      phoneInputRef.current?.focus();
    } finally {
      if (requestAttemptRef.current === attempt) {
        requestPendingRef.current = false;
        setIsRequesting(false);
      }
    }
  };

  const submitPhone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void requestChallenge();
  };

  const submitOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challenge || verificationPendingRef.current || requestPendingRef.current) return;
    if (!otpPattern.test(otp)) {
      setVerificationError("인증번호 6자리를 입력해 주세요.");
      otpInputRef.current?.focus();
      return;
    }

    const attempt = ++verificationAttemptRef.current;
    const challengeVersion = challengeVersionRef.current;
    if (!online) {
      setVerificationError("인터넷 연결이 끊겨 인증번호를 확인할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요.");
      otpInputRef.current?.focus();
      return;
    }
    verificationPendingRef.current = true;
    setIsVerifying(true);
    setVerificationError(null);
    setStatusMessage("인증번호를 확인하고 있어요.");
    try {
      const user = await createSession(
        { requestId: challenge.requestId, otp },
        () =>
          verificationAttemptRef.current === attempt &&
          challengeVersionRef.current === challengeVersion,
      );
      if (!user || verificationAttemptRef.current !== attempt || challengeVersionRef.current !== challengeVersion) {
        return;
      }
      setNavigationIntent("replace", "/");
      router.replace("/");
    } catch (error) {
      if (verificationAttemptRef.current !== attempt || challengeVersionRef.current !== challengeVersion) {
        return;
      }
      setVerificationError(messageForProblem(error));
      setStatusMessage("");
      otpInputRef.current?.focus();
    } finally {
      if (verificationAttemptRef.current === attempt) {
        verificationPendingRef.current = false;
        setIsVerifying(false);
      }
    }
  };

  const editPhoneNumber = () => {
    requestAttemptRef.current += 1;
    verificationAttemptRef.current += 1;
    requestPendingRef.current = false;
    verificationPendingRef.current = false;
    challengeVersionRef.current += 1;
    setIsRequesting(false);
    setIsVerifying(false);
    setChallenge(null);
    setOtp("");
    setRetryAvailableAt(null);
    setRequestError(null);
    setVerificationError(null);
    setStatusMessage("휴대전화 번호를 수정해 주세요.");
    setPhase("phone");
  };

  return (
    <ScreenShell className="px-5 pb-[max(var(--dimension-x6),env(safe-area-inset-bottom))] pt-[max(var(--dimension-x5),env(safe-area-inset-top))]" aria-labelledby="auth-heading">
      <header className="flex min-h-[var(--target-min)] items-center">
        <NavigationLink
          href="/"
          navigationIntent="pop"
          className="inline-flex min-h-[var(--target-min)] min-w-[var(--target-min)] items-center justify-center text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          aria-label="탐색으로 돌아가기"
        >
          <ArrowLeft size={24} strokeWidth={1.8} aria-hidden="true" />
        </NavigationLink>
      </header>

      {phase === "phone" ? (
        <section className="flex flex-1 flex-col pt-12" aria-describedby="auth-description">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--brand-accent)] text-[var(--fg-on-brand)]" aria-hidden="true">
            <ShieldCheck size={27} strokeWidth={1.8} />
          </div>
          <p className="font-display mb-2 mt-8 text-[length:var(--type-wordmark)] leading-6 text-[var(--fg-neutral)]">벙개</p>
          <h1 id="auth-heading" className="font-display m-0 max-w-[13ch] text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
            24시간 안에 안전하게 만나는 소규모 모임
          </h1>
          <p id="auth-description" className="m-0 mt-4 max-w-[29ch] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            공개 장소에서 함께할 모임을 찾고, 내게 맞는 활동에 참여해 보세요.
          </p>

          <OfflineNotice className="mt-6" />
          <form className="mt-auto pt-10" onSubmit={submitPhone} noValidate>
            <label className="grid gap-2 text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]" htmlFor="phone-number">
              휴대전화 번호
              <input
                ref={phoneInputRef}
                id="phone-number"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+821012345678"
                value={phoneNumber}
                onChange={(event) => {
                  requestAttemptRef.current += 1;
                  requestPendingRef.current = false;
                  setIsRequesting(false);
                  setPhoneNumber(event.target.value);
                  setRequestError(null);
                }}
                aria-invalid={requestError ? true : undefined}
                aria-describedby={requestError ? "phone-error" : "phone-help"}
                className="min-h-[var(--action-primary-height)] w-full rounded-xl border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-[16px] text-[var(--fg-neutral)] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--fg-neutral)] focus:ring-2 focus:ring-[var(--brand-accent)]"
              />
            </label>
            <p id="phone-help" className="m-0 mt-2 text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">
              국가 코드를 포함해 입력해 주세요. 예: +821012345678
            </p>
            {requestError ? (
              <p id="phone-error" className="m-0 mt-3 text-[length:var(--type-body)] leading-5 text-[var(--fg-critical)]" role="alert">
                {requestError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isBusy || !online}
              className="mt-5 flex min-h-[var(--action-primary-height)] w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--bg-neutral-pressed)] disabled:text-[var(--fg-muted)]"
            >
              <Smartphone size={20} strokeWidth={1.8} aria-hidden="true" />
              {isRequesting ? "인증번호 요청 중…" : "휴대전화로 시작하기"}
            </button>
            <p className="m-0 mt-4 text-center text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">
              만 18세 이상만 이용할 수 있어요.
            </p>
          </form>
        </section>
      ) : (
        <section className="flex flex-1 flex-col pt-12" aria-describedby="otp-description">
          <p className="font-display mb-2 mt-0 text-[length:var(--type-wordmark)] leading-6 text-[var(--fg-neutral)]">벙개</p>
          <h1 id="auth-heading" className="font-display m-0 text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
            인증번호를 입력해 주세요
          </h1>
          <p id="otp-description" className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            {phoneNumber}로 보낸 6자리 인증번호를 입력해 주세요.
          </p>
          <button
            type="button"
            onClick={editPhoneNumber}
            disabled={isVerifying}
            className="mt-3 inline-flex min-h-[var(--target-min)] w-fit items-center text-[length:var(--type-title)] font-bold text-[var(--fg-neutral)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:text-[var(--fg-muted)]"
          >
            번호 수정
          </button>

          <OfflineNotice className="mt-6" />
          <form className="mt-auto pt-10" onSubmit={submitOtp} noValidate>
            <label className="grid gap-2 text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]" htmlFor="otp-code">
              인증번호
              <input
                ref={otpInputRef}
                id="otp-code"
                name="otp"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(event) => {
                  verificationAttemptRef.current += 1;
                  verificationPendingRef.current = false;
                  setIsVerifying(false);
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setVerificationError(null);
                }}
                aria-invalid={verificationError ? true : undefined}
                aria-describedby={verificationError ? "otp-error" : undefined}
                className="min-h-[var(--action-primary-height)] w-full rounded-xl border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-center text-[24px] tracking-[0.3em] text-[var(--fg-neutral)] outline-none focus:border-[var(--fg-neutral)] focus:ring-2 focus:ring-[var(--brand-accent)]"
              />
            </label>
            {verificationError ? (
              <p id="otp-error" className="m-0 mt-3 text-[length:var(--type-body)] leading-5 text-[var(--fg-critical)]" role="alert">
                {verificationError}
              </p>
            ) : null}
            {requestError ? (
              <p className="m-0 mt-3 text-[length:var(--type-body)] leading-5 text-[var(--fg-critical)]" role="alert">
                {requestError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isBusy || !online}
              className="mt-5 flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-xl bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--bg-neutral-pressed)] disabled:text-[var(--fg-muted)]"
            >
              {isVerifying ? "인증 중…" : "인증하고 시작하기"}
            </button>
            <button
              type="button"
              disabled={isBusy || retryAfterSeconds > 0 || !online}
              onClick={() => void requestChallenge()}
              className="mt-3 flex min-h-[var(--target-min)] w-full items-center justify-center text-[length:var(--type-title)] font-bold text-[var(--fg-neutral)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:no-underline disabled:text-[var(--fg-muted)]"
            >
              {retryAfterSeconds > 0
                ? `재전송 가능까지 ${String(Math.floor(retryAfterSeconds / 60)).padStart(2, "0")}:${String(retryAfterSeconds % 60).padStart(2, "0")}`
                : "인증번호 다시 받기"}
            </button>
          </form>
        </section>
      )}
      <p className="sr-only" aria-live="polite">{statusMessage}</p>
    </ScreenShell>
  );
}
