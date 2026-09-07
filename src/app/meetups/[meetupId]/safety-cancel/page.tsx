"use client";

import { ChevronRight, CircleCheck, ShieldAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { OfflineNotice } from "@/components/offline-notice";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { Meetup } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { useOnlineStatus } from "@/lib/ui/online";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiProblemError ? error.problem?.detail ?? fallback : fallback;
}

export default function SafetyCancelPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "";
  const meetupHref = `/meetups/${encodeURIComponent(meetupId)}`;
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  // Session-scoped identity: the same subject logging in again after logout is
  // a distinct UI session, so late detail or cancellation completions cannot
  // render in the new session.
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  const subjectRef = useRef(subject);
  const epochRef = useRef(sessionEpoch);
  const meetupIdRef = useRef(meetupId);
  subjectRef.current = subject;
  epochRef.current = sessionEpoch;
  meetupIdRef.current = meetupId;
  const requestRef = useRef(0);
  const identity = `${sessionEpoch}:${subject ?? "anonymous"}:${meetupId}`;
  const attemptRef = useRef<{ identity: string; reason: string; key: string; inFlight: Promise<Meetup> | null } | null>(null);
  const [detail, setDetail] = useState<{ identity: string; status: "idle" | "loading" | "ready" | "error"; meetup: Meetup | null; error: string | null }>({ identity: "", status: "idle", meetup: null, error: null });
  const [helpOpen, setHelpOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ identity: string; meetup: Meetup | null; error: string | null; pending: boolean }>({ identity: "", meetup: null, error: null, pending: false });
  const currentDetail = detail.identity === identity ? detail : { identity, status: "idle" as const, meetup: null, error: null };
  const currentResult = result.identity === identity ? result : { identity, meetup: null, error: null, pending: false };
  const online = useOnlineStatus();

  const loadMeetup = useCallback(async () => {
    if (!auth || !subject || !meetupId) return;
    const request = ++requestRef.current;
    setDetail({ identity, status: "loading", meetup: null, error: null });
    try {
      const meetup = await auth.getMeetup(meetupId);
      if (request !== requestRef.current || subjectRef.current !== subject || epochRef.current !== sessionEpoch || meetupIdRef.current !== meetupId) return;
      setDetail({ identity, status: "ready", meetup, error: null });
    } catch (error) {
      if (request !== requestRef.current || subjectRef.current !== subject || epochRef.current !== sessionEpoch || meetupIdRef.current !== meetupId || error instanceof SessionExpiredError) return;
      setDetail({ identity, status: "error", meetup: null, error: errorMessage(error, "모임을 불러오지 못했어요.") });
    }
  }, [auth, identity, meetupId, sessionEpoch, subject]);

  useEffect(() => {
    requestRef.current += 1;
    attemptRef.current = null;
    setReason("");
    setHelpOpen(false);
    setResult({ identity, meetup: null, error: null, pending: false });
    if (!subject) {
      setDetail({ identity, status: "idle", meetup: null, error: null });
      return;
    }
    void loadMeetup();
    return () => { requestRef.current += 1; };
  }, [identity, loadMeetup, subject]);

  async function submitCancellation() {
    const normalizedReason = reason.trim();
    if (!auth || !subject || !meetupId || !currentDetail.meetup?.allowedActions.includes("CANCEL") || !normalizedReason || normalizedReason.length > 500 || !online) return;
    const existing = attemptRef.current?.identity === identity && attemptRef.current.reason === normalizedReason ? attemptRef.current : { identity, reason: normalizedReason, key: crypto.randomUUID(), inFlight: null };
    attemptRef.current = existing;
    if (existing.inFlight) return;
    setResult({ identity, meetup: null, error: null, pending: true });
    const request = auth.cancelMeetup(meetupId, { reason: normalizedReason }, existing.key);
    existing.inFlight = request;
    try {
      const meetup = await request;
      if (subjectRef.current !== subject || epochRef.current !== sessionEpoch || meetupIdRef.current !== meetupId) return;
      setResult({ identity, meetup, error: null, pending: false });
    } catch (error) {
      if (subjectRef.current !== subject || epochRef.current !== sessionEpoch || meetupIdRef.current !== meetupId || error instanceof SessionExpiredError) return;
      setResult({ identity, meetup: null, error: errorMessage(error, "모임 취소를 접수하지 못했어요. 다시 시도해 주세요."), pending: false });
    } finally {
      if (attemptRef.current === existing) existing.inFlight = null;
    }
  }

  const allowed = currentDetail.meetup?.allowedActions.includes("CANCEL") ?? false;
  const invalidReason = reason.trim().length === 0 || reason.trim().length > 500;

  return (
    <ScreenShell bottomSpacing>
      <TopNavigation href={meetupHref} title={<span className="font-display text-[length:var(--type-page-title)] font-normal leading-6">모임 취소 안내</span>} />
      <OfflineNotice className="mx-5 mt-5" />
      {currentResult.meetup ? (
        <div className="flex flex-1 flex-col px-5 pb-8"><ResultSection className="mt-14 px-0" tone="critical" heading="취소 접수됐어요" description="안전 사유로 모임을 취소했어요. 신고자와 상세 사유는 공개하지 않아요."><div className="border-t border-[var(--stroke-neutral)] pt-4 text-center text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]"><p className="m-0">접수와 처리 상태는 알림으로 안내해요.</p><p className="m-0 mt-1">이 화면은 취소 요청이 서버에 접수된 뒤에만 표시돼요.</p></div></ResultSection></div>
      ) : (
        <div className="flex flex-1 flex-col px-5 pb-8">
          <section className="mt-12 flex flex-col items-center text-center" aria-labelledby="safety-cancel-heading"><div className="flex size-[72px] items-center justify-center rounded-full bg-[var(--bg-critical-weak)] text-[var(--fg-critical)]" aria-hidden="true"><ShieldAlert size={34} strokeWidth={1.8} /></div><h2 id="safety-cancel-heading" className="mt-5 font-display text-[length:var(--type-headline)] font-normal leading-8 tracking-[-0.03em]">안전을 위해 모임을 취소할까요?</h2><p className="mt-4 max-w-[345px] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">참가자의 안전을 보호하기 위해 모임을 취소할 수 있어요. 신고자와 상세 사유는 공개하지 않아요.</p></section>
          {subject === null ? <p className="mt-6" role="alert">로그인한 뒤 모임 취소 가능 여부를 확인해 주세요.</p> : null}
          {currentDetail.status === "loading" ? <p className="mt-6" role="status">모임 정보를 확인하고 있어요.</p> : null}
          {currentDetail.status === "error" ? <div className="mt-6" role="alert"><p>{currentDetail.error}</p><button type="button" onClick={() => void loadMeetup()}>다시 시도</button></div> : null}
          {currentDetail.status === "ready" && !allowed ? <p className="mt-6" role="alert">현재 이 모임을 취소할 수 없어요.</p> : null}
          {allowed ? <div className="mt-6"><label htmlFor="cancel-reason" className="block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">안전 취소 사유</label><textarea id="cancel-reason" className="mt-2 min-h-28 w-full rounded-[12px] border border-[var(--stroke-neutral)] p-3" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} aria-describedby="cancel-reason-help" /><span id="cancel-reason-help" className="mt-2 block text-[var(--fg-muted)]">안전 문제가 무엇인지 알려 주세요. 최대 500자까지 입력할 수 있어요.</span></div> : null}
          <aside className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--bg-neutral-weak)] px-4 py-4" aria-label="취소 영향 안내"><CircleCheck className="mt-0.5 shrink-0 text-[var(--fg-muted)]" size={25} strokeWidth={1.8} aria-hidden="true" /><p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">이번 취소는 출석 신뢰와 참여 기록에 반영되지 않아요.</p></aside>
          {currentResult.error ? <p className="mt-4 text-[var(--fg-critical)]" role="alert">{currentResult.error}</p> : null}
          <button className="mt-6 flex min-h-[56px] w-full items-center justify-between border-b border-[var(--stroke-neutral)] py-3 text-left text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-critical)]" type="button" aria-expanded={helpOpen} onClick={() => setHelpOpen((current) => !current)}>긴급 도움과 안전 가이드 보기 <ChevronRight className={`shrink-0 transition-transform ${helpOpen ? "rotate-90" : ""}`} size={24} strokeWidth={1.8} aria-hidden="true" /></button>
          {helpOpen ? <p className="m-0 border-b border-[var(--stroke-neutral)] bg-[var(--bg-critical-weak)] px-4 py-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">지금 위험하다면 주변의 도움을 요청하고 112 또는 119에 연락하세요.</p> : null}
        </div>
      )}
      {!currentResult.meetup ? <BottomActionBar><button className="flex min-h-[52px] w-full items-center justify-center bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-on-brand)] disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void submitCancellation()} disabled={!allowed || invalidReason || currentResult.pending || !online}>{currentResult.pending ? "취소 요청 중…" : "안전 사유로 모임 취소하기"}</button></BottomActionBar> : null}
    </ScreenShell>
  );
}
