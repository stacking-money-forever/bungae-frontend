"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import { OfflineNotice } from "@/components/offline-notice";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { Withdrawal } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { useOnlineStatus } from "@/lib/ui/online";

type LoadState = "idle" | "loading" | "ready" | "error";
type PendingAction = "none" | "schedule" | "cancel";
type ScheduleKey = { identity: string; value: string } | null;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiProblemError ? error.problem?.detail ?? fallback : fallback;
}

export default function WithdrawalPage() {
  const auth = useOptionalAuthSession();
  const pathname = usePathname();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  // Route + session identity: same subject re-login is a new session, so old
  // completions must not render under the fresh login.
  const identity = subject ? `${sessionEpoch}:${subject}:${pathname}` : `anonymous:${pathname}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const online = useOnlineStatus();
  const requestRef = useRef(0);
  const scheduleKeyRef = useRef<ScheduleKey>(null);
  const scheduleInFlightRef = useRef<Promise<Withdrawal> | null>(null);
  const cancelInFlightRef = useRef<Promise<void> | null>(null);
  const scheduleTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>("none");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const loadWithdrawal = useCallback(async () => {
    if (!subject || !auth) return;
    const requestedIdentity = identity;
    const request = ++requestRef.current;
    setLoadState("loading");
    setError(null);
    try {
      const next = await auth.getWithdrawal();
      if (requestRef.current !== request || identityRef.current !== requestedIdentity) return;
      setWithdrawal(next);
      setLoadState("ready");
    } catch (nextError) {
      if (requestRef.current !== request || identityRef.current !== requestedIdentity || nextError instanceof SessionExpiredError) return;
      setWithdrawal(null);
      setLoadState("error");
      setError(errorMessage(nextError, "탈퇴 예약 상태를 불러오지 못했어요. 다시 시도해 주세요."));
    }
  }, [auth, identity, subject]);

  useEffect(() => {
    requestRef.current += 1;
    scheduleKeyRef.current = null;
    scheduleInFlightRef.current = null;
    cancelInFlightRef.current = null;
    setWithdrawal(null);
    setLoadState("idle");
    setError(null);
    setNotice(null);
    setPendingAction("none");
    setScheduleDialogOpen(false);
    setCancelDialogOpen(false);
    if (subject) void loadWithdrawal();
    return () => {
      requestRef.current += 1;
    };
  }, [identity, loadWithdrawal, subject]);

  useEffect(() => {
    if (notice) successRef.current?.focus();
  }, [notice]);

  const scheduleWithdrawal = async () => {
    if (!subject || !auth || scheduleInFlightRef.current) return;
    const requestedIdentity = identity;
    if (!online) {
      setError("인터넷 연결이 끊겨 탈퇴를 예약할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    const existingKey = scheduleKeyRef.current;
    const idempotencyKey = existingKey?.identity === requestedIdentity ? existingKey.value : crypto.randomUUID();
    scheduleKeyRef.current = { identity: requestedIdentity, value: idempotencyKey };
    setPendingAction("schedule");
    setError(null);
    setNotice(null);
    const request = auth.scheduleWithdrawal(idempotencyKey);
    scheduleInFlightRef.current = request;
    try {
      const next = await request;
      if (identityRef.current !== requestedIdentity) return;
      setWithdrawal(next);
      setLoadState("ready");
      setNotice("계정 탈퇴가 예약됐어요. 서버가 안내한 예약 시각까지 계정을 유지해요.");
    } catch (nextError) {
      if (identityRef.current !== requestedIdentity || nextError instanceof SessionExpiredError) return;
      setError(errorMessage(nextError, "계정 탈퇴 예약을 완료하지 못했어요. 다시 시도해 주세요."));
    } finally {
      if (scheduleInFlightRef.current === request) scheduleInFlightRef.current = null;
      if (identityRef.current === requestedIdentity) setPendingAction("none");
    }
  };

  const cancelWithdrawal = async () => {
    if (!subject || !auth || withdrawal?.state !== "SCHEDULED" || cancelInFlightRef.current) return;
    const requestedIdentity = identity;
    if (!online) {
      setError("인터넷 연결이 끊겨 탈퇴 예약을 취소할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    const version = withdrawal.version;
    setPendingAction("cancel");
    setError(null);
    setNotice(null);
    const request = auth.cancelWithdrawal(version);
    cancelInFlightRef.current = request;
    try {
      await request;
      if (identityRef.current !== requestedIdentity) return;
      await loadWithdrawal();
      if (identityRef.current !== requestedIdentity) return;
      setNotice("탈퇴 예약을 취소했고 서버 상태를 다시 확인했어요.");
    } catch (nextError) {
      if (identityRef.current !== requestedIdentity || nextError instanceof SessionExpiredError) return;
      if (nextError instanceof ApiProblemError && nextError.status === 409) {
        await loadWithdrawal();
        if (identityRef.current !== requestedIdentity) return;
        setError("예약 상태가 바뀌어 최신 정보를 다시 불러왔어요. 상태를 확인한 뒤 다시 시도해 주세요.");
        return;
      }
      setError(errorMessage(nextError, "탈퇴 예약을 취소하지 못했어요. 다시 시도해 주세요."));
    } finally {
      if (cancelInFlightRef.current === request) cancelInFlightRef.current = null;
      if (identityRef.current === requestedIdentity) setPendingAction("none");
    }
  };

  if (!subject || !auth) {
    return (
      <ScreenShell className="px-5 pb-8" aria-label="로그인 필요">
        <TopNavigation href="/profile" title={<span className="font-display text-[16px] font-normal leading-6">계정 탈퇴</span>} className="-mx-5 px-4" />
        <section className="pt-12" aria-labelledby="withdrawal-auth-heading">
          <h1 id="withdrawal-auth-heading" className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">로그인한 계정에서만 탈퇴를 예약할 수 있어요</h1>
          <p className="m-0 mt-4 text-[14px] leading-[22px] text-[var(--fg-muted)]">계정과 예약 상태를 확인하려면 먼저 로그인해 주세요.</p>
        </section>
      </ScreenShell>
    );
  }

  const scheduled = withdrawal?.state === "SCHEDULED";
  const isPending = pendingAction !== "none";
  const canCancel = scheduled && !isPending && online;
  const stateHeading = withdrawal
    ? withdrawal.state === "SCHEDULED"
      ? "탈퇴가 예약되어 있어요"
      : withdrawal.state === "CANCELLED"
        ? "탈퇴 예약이 취소됐어요"
        : withdrawal.state === "COMPLETED"
          ? "계정 탈퇴가 완료됐어요"
          : "탈퇴 예약 상태를 확인할 수 없어요"
    : null;

  return (
    <ScreenShell className="px-5 pb-8">
      <TopNavigation href="/profile" title={<span className="font-display text-[16px] font-normal leading-6">계정 탈퇴</span>} className="-mx-5 px-4" />
      <section className="pt-6" aria-labelledby="withdrawal-heading">
        <section className="rounded-2xl bg-[var(--bg-layer-floating)] p-4" aria-labelledby="withdrawal-heading">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0 text-[var(--fg-neutral)]" size={24} strokeWidth={1.8} aria-hidden="true" />
            <div>
              <h1 id="withdrawal-heading" className="m-0 text-[18px] font-bold leading-7 text-[var(--fg-neutral)]">계정 탈퇴 예약</h1>
              <p className="m-0 mt-2 text-[14px] leading-5 text-[var(--fg-muted)]">예약이 완료된 뒤에도 서버가 안내한 시각 전에는 취소할 수 있어요. 예약과 취소 결과는 서버 상태를 기준으로 표시해요.</p>
            </div>
          </div>
        </section>

        {loadState === "loading" ? <p className="mt-6 text-[14px] leading-5 text-[var(--fg-muted)]" role="status">탈퇴 예약 상태를 불러오는 중이에요.</p> : null}
        <OfflineNotice className="mt-6" />
        {loadState === "error" ? <section className="mt-6 grid gap-3" aria-labelledby="withdrawal-load-error"><p id="withdrawal-load-error" className="m-0 text-[14px] leading-5 text-[var(--fg-neutral)]" role="alert">{error}</p><button type="button" onClick={() => void loadWithdrawal()} className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-[var(--stroke-neutral)] px-3 text-[14px] font-bold text-[var(--fg-neutral)]"><RefreshCw size={18} aria-hidden="true" />다시 불러오기</button></section> : null}

        {loadState === "ready" && withdrawal ? (
          <section className="mt-6 rounded-2xl border border-[var(--stroke-neutral)] p-4" aria-labelledby="withdrawal-state-title">
            <div className="flex items-center gap-2"><CalendarClock size={21} aria-hidden="true" /><h2 id="withdrawal-state-title" className="m-0 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">{stateHeading}</h2></div>
            <dl className="m-0 mt-4 grid gap-3 text-[14px] leading-5 text-[var(--fg-neutral)]"><div><dt className="text-[var(--fg-muted)]">요청 시각</dt><dd className="m-0 mt-1 break-all">{withdrawal.requestedAt}</dd></div><div><dt className="text-[var(--fg-muted)]">적용 시각</dt><dd className="m-0 mt-1 break-all">{withdrawal.effectiveAt}</dd></div>{withdrawal.cancelledAt ? <div><dt className="text-[var(--fg-muted)]">취소 시각</dt><dd className="m-0 mt-1 break-all">{withdrawal.cancelledAt}</dd></div> : null}{withdrawal.completedAt ? <div><dt className="text-[var(--fg-muted)]">완료 시각</dt><dd className="m-0 mt-1 break-all">{withdrawal.completedAt}</dd></div> : null}</dl>
            {scheduled ? <AnimatedDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen} onCloseAutoFocus={(event) => { event.preventDefault(); cancelTriggerRef.current?.focus(); }} trigger={<button ref={cancelTriggerRef} type="button" disabled={!canCancel} className="mt-5 min-h-[48px] w-full border border-[var(--fg-neutral)] px-3 text-[15px] font-bold text-[var(--fg-neutral)] disabled:opacity-60">{pendingAction === "cancel" ? "취소 처리 중" : "탈퇴 예약 취소"}</button>}><AnimatedDialogTitle className="m-0 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">탈퇴 예약을 취소할까요?</AnimatedDialogTitle><AnimatedDialogDescription className="m-0 mt-2 text-[14px] leading-5 text-[var(--fg-muted)]">취소가 완료되기 전까지는 예약 상태가 유지돼요.</AnimatedDialogDescription><div className="mt-4 flex gap-2"><AnimatedDialogClose asChild><button type="button" disabled={isPending || !online} className="min-h-[44px] flex-1 border border-[var(--stroke-neutral)] px-3 text-[15px] text-[var(--fg-neutral)]">닫기</button></AnimatedDialogClose><button type="button" disabled={isPending || !online} onClick={() => { setCancelDialogOpen(false); void cancelWithdrawal(); }} className="min-h-[44px] flex-1 bg-[var(--fg-neutral)] px-3 text-[15px] font-bold text-[var(--bg-layer-floating)] disabled:opacity-60">예약 취소</button></div></AnimatedDialog> : null}
          </section>
        ) : null}

        {loadState === "ready" && !withdrawal ? <section className="mt-6 rounded-2xl border border-[var(--stroke-neutral)] p-4" aria-labelledby="withdrawal-empty-title"><h2 id="withdrawal-empty-title" className="m-0 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">진행 중인 탈퇴 예약이 없어요</h2><p className="m-0 mt-2 text-[14px] leading-5 text-[var(--fg-muted)]">계정을 떠나기로 결정했다면 내용을 확인한 뒤 예약해 주세요.</p><AnimatedDialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen} onCloseAutoFocus={(event) => { event.preventDefault(); scheduleTriggerRef.current?.focus(); }} trigger={<button ref={scheduleTriggerRef} type="button" disabled={isPending || !online} className="mt-5 min-h-[48px] w-full bg-[var(--fg-neutral)] px-3 text-[15px] font-bold text-[var(--bg-layer-floating)] disabled:opacity-60">{pendingAction === "schedule" ? "예약 처리 중" : "계정 탈퇴 예약"}</button>}><AnimatedDialogTitle className="m-0 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">계정 탈퇴를 예약할까요?</AnimatedDialogTitle><AnimatedDialogDescription className="m-0 mt-2 text-[14px] leading-5 text-[var(--fg-muted)]">예약이 완료되기 전에는 탈퇴가 시작되지 않아요. 서버가 안내한 적용 시각 전까지는 예약을 취소할 수 있어요.</AnimatedDialogDescription><div className="mt-4 flex gap-2"><AnimatedDialogClose asChild><button type="button" disabled={isPending || !online} className="min-h-[44px] flex-1 border border-[var(--stroke-neutral)] px-3 text-[15px] text-[var(--fg-neutral)]">닫기</button></AnimatedDialogClose><button type="button" disabled={isPending || !online} onClick={() => { setScheduleDialogOpen(false); void scheduleWithdrawal(); }} className="min-h-[44px] flex-1 bg-[var(--fg-neutral)] px-3 text-[15px] font-bold text-[var(--bg-layer-floating)] disabled:opacity-60">탈퇴 예약</button></div></AnimatedDialog></section> : null}

        {error && loadState !== "error" ? <section className="mt-4 grid gap-3" aria-labelledby="withdrawal-mutation-error"><p id="withdrawal-mutation-error" className="m-0 text-[14px] leading-5 text-[var(--fg-neutral)]" role="alert">{error}</p><button type="button" onClick={() => scheduled ? setCancelDialogOpen(true) : setScheduleDialogOpen(true)} disabled={isPending} className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-[var(--stroke-neutral)] px-3 text-[14px] font-bold text-[var(--fg-neutral)] disabled:opacity-60"><AlertTriangle size={18} aria-hidden="true" />다시 시도</button></section> : null}
        {notice ? <p ref={successRef} tabIndex={-1} className="mt-4 flex gap-2 text-[14px] leading-5 text-[var(--fg-neutral)] outline-none" role="status"><CheckCircle2 className="shrink-0" size={20} aria-hidden="true" />{notice}</p> : null}
      </section>
    </ScreenShell>
  );
}
