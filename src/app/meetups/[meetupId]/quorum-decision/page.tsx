"use client";

import { Clock3, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import { BottomActionBar } from "@/components/bottom-action-bar";
import { OfflineNotice } from "@/components/offline-notice";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { Meetup, QuorumDecision, QuorumDecisionResult } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { useOnlineStatus } from "@/lib/ui/online";

function errorMessage(error: unknown) {
  return error instanceof ApiProblemError ? error.problem?.detail ?? "진행 여부를 결정하지 못했어요. 다시 시도해 주세요." : "진행 여부를 결정하지 못했어요. 다시 시도해 주세요.";
}

export default function QuorumDecisionPage() {
  const { meetupId: routeMeetupId } = useParams<{ meetupId: string }>();
  const meetupId = typeof routeMeetupId === "string" ? routeMeetupId : "";
  const meetupPath = `/meetups/${encodeURIComponent(meetupId)}`;
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  // Session-scoped identity: the same subject logging in again after logout is
  // a distinct UI session, so late detail or decision completions cannot render.
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  const subjectRef = useRef(subject);
  const epochRef = useRef(sessionEpoch);
  const meetupIdRef = useRef(meetupId);
  subjectRef.current = subject;
  epochRef.current = sessionEpoch;
  meetupIdRef.current = meetupId;
  const requestRef = useRef(0);
  const identity = `${sessionEpoch}:${subject ?? "anonymous"}:${meetupId}`;
  const attemptRef = useRef<{ identity: string; decision: QuorumDecision; key: string; inFlight: Promise<QuorumDecisionResult> | null } | null>(null);
  const [detail, setDetail] = useState<{ identity: string; status: "idle" | "loading" | "ready" | "error"; meetup: Meetup | null; error: string | null }>({ identity: "", status: "idle", meetup: null, error: null });
  const [dialogDecision, setDialogDecision] = useState<QuorumDecision | null>(null);
  const proceedTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement>(null);
  const lastOpenedDecisionRef = useRef<QuorumDecision | null>(null);
  const dialogCommitRef = useRef(false);
  const [mutation, setMutation] = useState<{ identity: string; result: QuorumDecisionResult | null; error: string | null; pending: boolean; conflict: boolean }>({ identity: "", result: null, error: null, pending: false, conflict: false });
  const currentDetail = detail.identity === identity ? detail : { identity, status: "idle" as const, meetup: null, error: null };
  const currentMutation = mutation.identity === identity ? mutation : { identity, result: null, error: null, pending: false, conflict: false };
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
    setDialogDecision(null);
    setMutation({ identity, result: null, error: null, pending: false, conflict: false });
    lastOpenedDecisionRef.current = null;
    dialogCommitRef.current = false;
    if (!subject) {
      setDetail({ identity, status: "idle", meetup: null, error: null });
      return;
    }
    void loadMeetup();
    return () => { requestRef.current += 1; };
  }, [identity, loadMeetup, subject]);


  function openDialog(decision: QuorumDecision) {
    lastOpenedDecisionRef.current = decision;
    dialogCommitRef.current = false;
    setDialogDecision(decision);
  }

  function handleDialogExitComplete() {
    const dismissedDecision = lastOpenedDecisionRef.current;
    lastOpenedDecisionRef.current = null;
    if (!dialogCommitRef.current) {
      if (dismissedDecision === "PROCEED") proceedTriggerRef.current?.focus();
      if (dismissedDecision === "CANCEL") cancelTriggerRef.current?.focus();
    }
    dialogCommitRef.current = false;
  }
  async function decide(decision: QuorumDecision) {
    if (!auth || !subject || !meetupId || !currentDetail.meetup?.allowedActions.includes("QUORUM_DECISION") || !online) return;
    const existing = attemptRef.current?.identity === identity && attemptRef.current.decision === decision ? attemptRef.current : { identity, decision, key: crypto.randomUUID(), inFlight: null };
    attemptRef.current = existing;
    if (existing.inFlight) return;
    dialogCommitRef.current = true;
    setDialogDecision(null);
    setMutation({ identity, result: null, error: null, pending: true, conflict: false });
    const request = auth.decideQuorum(meetupId, decision, currentDetail.meetup.version, existing.key);
    existing.inFlight = request;
    try {
      const result = await request;
      if (subjectRef.current !== subject || epochRef.current !== sessionEpoch || meetupIdRef.current !== meetupId) return;
      setMutation({ identity, result, error: null, pending: false, conflict: false });
    } catch (error) {
      if (subjectRef.current !== subject || epochRef.current !== sessionEpoch || meetupIdRef.current !== meetupId || error instanceof SessionExpiredError) return;
      const conflict = error instanceof ApiProblemError && error.status === 409;
      setMutation({ identity, result: null, error: errorMessage(error), pending: false, conflict });
      if (conflict) await loadMeetup();
    } finally {
      if (attemptRef.current === existing) existing.inFlight = null;
    }
  }

  const allowed = currentDetail.meetup?.allowedActions.includes("QUORUM_DECISION") ?? false;
  const meetup = currentDetail.meetup;
  const activeDecision = dialogDecision ?? "CANCEL";
  return (
    <>
      <AnimatedDialog open={dialogDecision !== null} onOpenChange={(open) => { if (!open) setDialogDecision(null); }} onExitComplete={handleDialogExitComplete}>
        <AnimatedDialogTitle className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">{activeDecision === "PROCEED" ? "현재 인원으로 진행할까요?" : "모임을 취소할까요?"}</AnimatedDialogTitle>
        <AnimatedDialogDescription className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">{activeDecision === "PROCEED" ? "참가자에게 진행 확정 소식을 알리고 체크인을 준비해요." : "인원 미달 취소는 출석 기록에 영향을 주지 않아요."}</AnimatedDialogDescription>
        <div className="mt-5 flex gap-2"><AnimatedDialogClose asChild><button className="inline-flex min-h-[var(--target-min)] flex-1 items-center justify-center rounded-[10px] bg-[var(--bg-layer-floating)] px-3 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-neutral)] ring-1 ring-inset ring-[var(--stroke-neutral)]" type="button">돌아가기</button></AnimatedDialogClose><button className="inline-flex min-h-[var(--target-min)] flex-1 items-center justify-center rounded-[10px] bg-[var(--brand-accent)] px-3 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)]" type="button" onClick={() => void decide(activeDecision)}>{activeDecision === "PROCEED" ? "진행하기" : "취소하기"}</button></div>
      </AnimatedDialog>
      <ScreenShell bottomSpacing aria-label="최소 인원 미달 결정">
        <TopNavigation href={meetupPath} title="진행 여부 결정" />
        <OfflineNotice className="mx-5 mt-5" />
        {currentMutation.result ? (
          <ResultSection className="px-[var(--dimension-x5)] pb-8 pt-12" tone="neutral" heading={currentMutation.result.quorumDecision === "PROCEED" ? "모임을 진행하기로 했어요" : "모임을 취소했어요"} description={currentMutation.result.quorumDecision === "PROCEED" ? "서버에서 진행 결정을 반영했어요." : "서버에서 인원 미달 취소를 반영했어요."}><p className="m-0 text-[length:var(--type-body)] text-[var(--fg-muted)]">현재 참가자 {currentMutation.result.joinedCount}명</p></ResultSection>
        ) : (
          <>
            <section className="w-full bg-[var(--bg-warning-weak)] px-[var(--dimension-x5)] py-[var(--dimension-x4)]" role="status"><p className="m-0 text-[length:var(--type-section)] font-bold leading-6 text-[var(--fg-warning)]">결정 필요</p><h2 className="m-0 mt-1 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">진행 여부를 정해 주세요</h2><p className="m-0 mt-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">서버가 허용한 경우에만 진행 또는 취소를 결정할 수 있어요.</p></section>
            <div className="px-[var(--dimension-x5)] pb-8 pt-6">
              {subject === null ? <p role="alert">로그인한 뒤 진행 여부를 확인해 주세요.</p> : null}
              {currentDetail.status === "loading" ? <p role="status">모임 정보를 확인하고 있어요.</p> : null}
              {currentDetail.status === "error" ? <div role="alert"><p>{currentDetail.error}</p><button type="button" onClick={() => void loadMeetup()}>다시 시도</button></div> : null}
              {currentDetail.status === "ready" && !allowed ? <p role="alert">현재 이 모임의 진행 여부를 결정할 수 없어요.</p> : null}
              {meetup ? <section className="mt-4 rounded-[12px] bg-[var(--bg-neutral-weak)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="m-0 font-display text-[length:var(--type-section)] font-normal leading-6 text-[var(--fg-neutral)]">현재 {meetup.joinedCount}명</h3><p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">최소 {meetup.minimumParticipants}명 · 정원 {meetup.capacity}명</p></div><div className="mt-4 flex items-center gap-3 text-[var(--fg-muted)]"><UsersRound size={28} aria-hidden="true" /><span>인원 현황은 방금 읽은 모임 상세 정보예요.</span></div></section> : null}
              <dl className="m-0 mt-6 border-b border-[var(--stroke-neutral)]"><div className="flex min-h-[74px] items-center gap-3 border-b border-[var(--stroke-neutral)]"><Clock3 className="shrink-0 text-[var(--fg-warning)]" size={28} aria-hidden="true" /><div><dt className="m-0 font-display text-[length:var(--type-time)] font-normal leading-6 text-[var(--fg-neutral)]">결정 대기 중</dt><dd className="m-0 text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">서버 상태가 바뀌면 다시 확인해 주세요.</dd></div></div><div className="flex min-h-[86px] items-center gap-3"><ShieldCheck className="shrink-0 text-[var(--fg-muted)]" size={28} aria-hidden="true" /><div><dt className="m-0 text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">취소해도 출석 기록에 불이익이 없어요</dt><dd className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">인원 미달로 취소해도 누구에게도 불이익이 없어요.</dd></div></div></dl>
              {currentMutation.error ? <div className="mt-4" role="alert"><p>{currentMutation.error}</p>{currentMutation.conflict ? <p>최신 모임 정보를 다시 불러왔어요. 내용을 확인한 뒤 다시 결정해 주세요.</p> : null}</div> : null}
            </div>
          </>
        )}
        {!currentMutation.result ? <BottomActionBar><button ref={proceedTriggerRef} className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => openDialog("PROCEED")} disabled={!allowed || currentMutation.pending || !online}>현재 인원으로 진행하기</button><button ref={cancelTriggerRef} className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-neutral)] ring-1 ring-inset ring-[var(--stroke-neutral)] disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => openDialog("CANCEL")} disabled={!allowed || currentMutation.pending || !online}>인원 부족으로 취소하기</button></BottomActionBar> : <BottomActionBar><Link className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)]" href="/my-meetups">내 모임으로 돌아가기</Link></BottomActionBar>}
      </ScreenShell>
    </>
  );
}
