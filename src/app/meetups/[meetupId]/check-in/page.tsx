"use client";

import { ChevronRight, KeyRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { OfflineNotice } from "@/components/offline-notice";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { CheckInResult, Meetup } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { useOnlineStatus } from "@/lib/ui/online";

function errorMessage(error: unknown) {
  return error instanceof ApiProblemError ? error.problem?.detail ?? "체크인을 처리하지 못했어요. 다시 시도해 주세요." : "체크인을 처리하지 못했어요. 다시 시도해 주세요.";
}

export default function CheckInPage() {
  const { meetupId: routeMeetupId } = useParams<{ meetupId: string }>();
  const meetupId = typeof routeMeetupId === "string" ? routeMeetupId : "";
  const encodedMeetupId = encodeURIComponent(meetupId);
  const hubPath = `/meetups/${encodedMeetupId}/hub`;
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  // Session-scoped identity: the same subject logging in again after logout is
  // a distinct UI session, so late detail or check-in completions cannot render.
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  const subjectRef = useRef(subject);
  const epochRef = useRef(sessionEpoch);
  const meetupIdRef = useRef(meetupId);
  subjectRef.current = subject;
  epochRef.current = sessionEpoch;
  meetupIdRef.current = meetupId;
  const requestRef = useRef(0);
  const identity = `${sessionEpoch}:${subject ?? "anonymous"}:${meetupId}`;
  const attemptRef = useRef<{ identity: string; code: string; key: string; inFlight: Promise<CheckInResult> | null } | null>(null);
  const [detail, setDetail] = useState<{ identity: string; status: "idle" | "loading" | "ready" | "error"; meetup: Meetup | null; error: string | null }>({ identity: "", status: "idle", meetup: null, error: null });
  const [code, setCode] = useState("");
  const [mutation, setMutation] = useState<{ identity: string; result: CheckInResult | null; error: string | null; pending: boolean }>({ identity: "", result: null, error: null, pending: false });
  const currentDetail = detail.identity === identity ? detail : { identity, status: "idle" as const, meetup: null, error: null };
  const currentMutation = mutation.identity === identity ? mutation : { identity, result: null, error: null, pending: false };
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
      setDetail({ identity, status: "error", meetup: null, error: errorMessage(error) });
    }
  }, [auth, identity, meetupId, sessionEpoch, subject]);

  useEffect(() => {
    requestRef.current += 1;
    attemptRef.current = null;
    setCode("");
    setMutation({ identity, result: null, error: null, pending: false });
    if (!subject) {
      setDetail({ identity, status: "idle", meetup: null, error: null });
      return;
    }
    void loadMeetup();
    return () => { requestRef.current += 1; };
  }, [identity, loadMeetup, subject]);

  async function submitCheckIn() {
    const normalizedCode = code.trim();
    if (!auth || !subject || !meetupId || !currentDetail.meetup?.allowedActions.includes("CHECK_IN") || !normalizedCode || normalizedCode.length > 64 || !online) return;
    const existing = attemptRef.current?.identity === identity && attemptRef.current.code === normalizedCode ? attemptRef.current : { identity, code: normalizedCode, key: crypto.randomUUID(), inFlight: null };
    attemptRef.current = existing;
    if (existing.inFlight) return;
    setMutation({ identity, result: null, error: null, pending: true });
    const request = auth.checkInMeetup(meetupId, { method: "MEETUP_CODE", code: normalizedCode }, existing.key);
    existing.inFlight = request;
    try {
      const result = await request;
      if (subjectRef.current !== subject || epochRef.current !== sessionEpoch || meetupIdRef.current !== meetupId) return;
      setMutation({ identity, result, error: null, pending: false });
    } catch (error) {
      if (subjectRef.current !== subject || epochRef.current !== sessionEpoch || meetupIdRef.current !== meetupId || error instanceof SessionExpiredError) return;
      setMutation({ identity, result: null, error: errorMessage(error), pending: false });
    } finally {
      if (attemptRef.current === existing) existing.inFlight = null;
    }
  }

  const allowed = currentDetail.meetup?.allowedActions.includes("CHECK_IN") ?? false;
  const invalidCode = code.trim().length === 0 || code.trim().length > 64;
  return (
    <ScreenShell bottomSpacing aria-label="체크인 실행">
      <TopNavigation href={hubPath} title="체크인" />
      <OfflineNotice className="mx-5 mt-5" />
      {currentMutation.result ? (
        <ResultSection className="px-[var(--dimension-x5)] pb-8 pt-12" tone="neutral" heading="체크인됐어요" description="서버에서 출석 확인을 완료했어요."><p className="m-0 text-[length:var(--type-body)] text-[var(--fg-muted)]">확인 시각: {new Date(currentMutation.result.checkedInAt).toLocaleString("ko-KR")}</p></ResultSection>
      ) : (
        <div className="px-[var(--dimension-x5)] pb-8 pt-7">
          <p className="m-0 font-display text-[length:var(--type-time)] leading-6 text-[var(--fg-neutral)]">체크인 가능 여부를 모임 정보에서 확인해요.</p>
          <h2 className="m-0 mt-6 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">현장에 도착했나요?</h2>
          <p className="m-0 mt-6 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">모임 코드로 체크인할 수 있어요. 체크인은 실제 출석 확인에만 사용돼요.</p>
          {subject === null ? <p className="mt-6" role="alert">로그인한 뒤 체크인 가능 여부를 확인해 주세요.</p> : null}
          {currentDetail.status === "loading" ? <p className="mt-6" role="status">모임 정보를 확인하고 있어요.</p> : null}
          {currentDetail.status === "error" ? <div className="mt-6" role="alert"><p>{currentDetail.error}</p><button type="button" onClick={() => void loadMeetup()}>다시 시도</button></div> : null}
          {currentDetail.status === "ready" && !allowed ? <p className="mt-6" role="alert">현재 이 모임에 체크인할 수 없어요.</p> : null}
          {allowed ? <div className="mt-7"><label htmlFor="check-in-code" className="block text-[length:var(--type-section)] font-bold leading-6 text-[var(--fg-neutral)]">모임 코드</label><input id="check-in-code" className="mt-3 min-h-[56px] w-full rounded-[12px] border border-[var(--stroke-neutral)] px-4 font-display text-[length:var(--type-headline)]" value={code} maxLength={64} onChange={(event) => setCode(event.target.value)} autoComplete="off" aria-describedby="check-in-code-help" /><span id="check-in-code-help" className="mt-2 block text-[length:var(--type-body)] font-normal leading-[22px] text-[var(--fg-muted)]">주최자가 현장에서 안내한 코드를 입력해 주세요.</span></div> : null}
          <p className="m-0 mt-7 flex min-h-[72px] items-center gap-3 border-b border-[var(--stroke-neutral)] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]"><KeyRound className="shrink-0" size={28} strokeWidth={1.8} aria-hidden="true" />위치 권한 없이 모임 코드로 체크인할 수 있어요.</p>
          <Link className="flex min-h-[56px] items-center justify-between gap-3 border-b border-[var(--stroke-neutral)] text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-critical)]" href={`/meetups/${encodedMeetupId}/safety-cancel`}><span>도착했지만 안전이 걱정돼요</span><ChevronRight className="shrink-0" size={24} strokeWidth={1.8} aria-hidden="true" /></Link>
          {currentMutation.error ? <p className="mt-4 text-[var(--fg-critical)]" role="alert">{currentMutation.error}</p> : null}
        </div>
      )}
      {!currentMutation.result ? <BottomActionBar><button className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void submitCheckIn()} disabled={!allowed || invalidCode || currentMutation.pending || !online}>{currentMutation.pending ? "체크인 확인 중…" : "코드로 체크인하기"}</button></BottomActionBar> : null}
    </ScreenShell>
  );
}
