"use client";

import {
  CircleCheck,
  Flag,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import { BottomActionBar } from "@/components/bottom-action-bar";
import { OfflineNotice } from "@/components/offline-notice";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { JoinResult, Meetup } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { useOnlineStatus } from "@/lib/ui/online";


const reportReasons = [
  ["unsafe", "안전 위협"],
  ["harassment", "괴롭힘·혐오"],
  ["sexual", "성적 접근·데이트 목적 위장"],
  ["solicitation", "영업·종교·다단계 권유"],
  ["privacy", "개인정보 침해"],
  ["misleading", "허위 장소·목적"],
  ["attendance", "노쇼·반복 지각"],
  ["other", "기타"],
] as const;

export default function MeetupDetailPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "";
  const encodedMeetupId = encodeURIComponent(meetupId);
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  const online = useOnlineStatus();
  const subjectRef = useRef(subject);
  subjectRef.current = subject;
  const epochRef = useRef(sessionEpoch);
  epochRef.current = sessionEpoch;
  const meetupIdRef = useRef(meetupId);
  meetupIdRef.current = meetupId;
  const meetupRequest = useRef(0);
  const [meetupState, setMeetupState] = useState<{
    subject: string | null;
    epoch: number;
    meetupId: string;
    status: "idle" | "loading" | "ready" | "error";
    meetup: Meetup | null;
    relation: string | null;
    error: string | null;
  }>({ subject: null, epoch: 0, meetupId: "", status: "idle", meetup: null, relation: null, error: null });
  const detailStateMatchesRouteAndSession =
    meetupState.subject === subject &&
    meetupState.epoch === sessionEpoch &&
    meetupState.meetupId === meetupId;
  const currentMeetup = detailStateMatchesRouteAndSession ? meetupState.meetup : null;
  const currentRelation = detailStateMatchesRouteAndSession ? meetupState.relation : null;
  const authenticatedDetailLoading =
    subject !== null &&
    (!detailStateMatchesRouteAndSession ||
      meetupState.status === "idle" ||
      meetupState.status === "loading" ||
      (meetupState.status === "ready" && currentMeetup === null));
  const authenticatedDetailError =
    subject !== null && detailStateMatchesRouteAndSession && meetupState.status === "error";

  const loadMeetup = useCallback(async () => {
    if (!subject || !auth) return;
    const request = ++meetupRequest.current;
    setMeetupState({ subject, epoch: sessionEpoch, meetupId, status: "loading", meetup: null, relation: null, error: null });
    try {
      const meetup = await auth.getMeetup(meetupId);
      let relation: string | null = null;
      let cursor: string | undefined;
      const seenCursors = new Set<string>();
      try {
        do {
          const page = await auth.listMyMeetups({ relation: "ALL", cursor, limit: 100 });
          relation = page.items.find((item) => item.id === meetupId)?.relation ?? null;
          if (relation || !page.nextCursor || seenCursors.has(page.nextCursor)) break;
          cursor = page.nextCursor;
          seenCursors.add(cursor);
        } while (true);
      } catch (error) {
        if (error instanceof SessionExpiredError) throw error;
        if (meetupRequest.current !== request || subjectRef.current !== subject || epochRef.current !== sessionEpoch) return;
        setMeetupState({
          subject,
          epoch: sessionEpoch,
          meetupId,
          status: "error",
          meetup: null,
          relation: null,
          error: "참여 여부를 확인하지 못했어요. 다시 시도해 주세요.",
        });
        return;
      }
      if (meetupRequest.current !== request || subjectRef.current !== subject || epochRef.current !== sessionEpoch) return;
      setMeetupState({ subject, epoch: sessionEpoch, meetupId, status: "ready", meetup, relation, error: null });
    } catch (error) {
      if (meetupRequest.current !== request || subjectRef.current !== subject || epochRef.current !== sessionEpoch || error instanceof SessionExpiredError) return;
      setMeetupState({
        subject,
        epoch: sessionEpoch,
        meetupId,
        status: "error",
        meetup: null,
        relation: null,
        error: error instanceof ApiProblemError ? error.problem?.detail ?? "모임을 불러오지 못했어요." : "모임을 불러오지 못했어요.",
      });
    }
  }, [auth, meetupId, sessionEpoch, subject]);

  useEffect(() => {
    meetupRequest.current += 1;
    if (!subject) {
      setMeetupState({ subject: null, epoch: 0, meetupId: "", status: "idle", meetup: null, relation: null, error: null });
      return;
    }
    void loadMeetup();
    return () => {
      meetupRequest.current += 1;
    };
  }, [loadMeetup, subject]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [urgentReport, setUrgentReport] = useState(false);
  const [reported, setReported] = useState(false);
  const [reportPending, setReportPending] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const reportAttemptRef = useRef<{ identity: string; payload: string; idempotencyKey: string; inFlight: boolean } | null>(null);
  const reportTriggerRef = useRef<HTMLButtonElement>(null);
  const reportWasOpened = useRef(false);
  const detailLocalIdentity = `${sessionEpoch}:${subject ?? "anonymous"}:${meetupId}`;
  const [detailLocalStateIdentity, setDetailLocalStateIdentity] = useState(detailLocalIdentity);
  const detailLocalStateIsCurrent = detailLocalStateIdentity === detailLocalIdentity;
  const activeReportOpen = detailLocalStateIsCurrent && reportOpen;
  const activeReported = detailLocalStateIsCurrent && reported;
  const [joinState, setJoinState] = useState<{
    identity: string;
    status: "idle" | "pending" | "error" | "done";
    result: JoinResult | null;
    error: string | null;
  }>({ identity: "", status: "idle", result: null, error: null });
  const [leaveState, setLeaveState] = useState<{
    identity: string;
    status: "idle" | "pending" | "error" | "done";
    error: string | null;
  }>({ identity: "", status: "idle", error: null });
  const joinAttemptRef = useRef<{ identity: string; idempotencyKey: string; inFlight: Promise<JoinResult> | null } | null>(null);
  const leaveAttemptRef = useRef<{ identity: string; inFlight: Promise<void> | null } | null>(null);
  const activeJoinState = joinState.identity === detailLocalIdentity ? joinState : { identity: detailLocalIdentity, status: "idle" as const, result: null, error: null };
  const activeLeaveState = leaveState.identity === detailLocalIdentity ? leaveState : { identity: detailLocalIdentity, status: "idle" as const, error: null };

  useEffect(() => {
    if (detailLocalStateIdentity === detailLocalIdentity) return;

    setReportOpen(false);
    setReportReason("");
    setReportDetail("");
    setUrgentReport(false);
    setReported(false);
    setReportPending(false);
    setReportError(null);
    reportAttemptRef.current = null;
    joinAttemptRef.current = null;
    leaveAttemptRef.current = null;
    setJoinState({ identity: detailLocalIdentity, status: "idle", result: null, error: null });
    setLeaveState({ identity: detailLocalIdentity, status: "idle", error: null });
    setDetailLocalStateIdentity(detailLocalIdentity);
  }, [detailLocalIdentity, detailLocalStateIdentity]);
  useEffect(() => {
    if (activeReported) {
      document.getElementById("meetup-report-receipt")?.focus();
    }
  }, [activeReported]);


  function openReportDialog() {
    if (!detailLocalStateIsCurrent) return;
    reportWasOpened.current = true;
    setReportOpen(true);
  }

  function handleReportOpenChange(open: boolean) {
    if (!detailLocalStateIsCurrent) return;
    if (open) reportWasOpened.current = true;
    setReportOpen(open);
  }

  async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailLocalStateIsCurrent || !auth || !subject || !reportReason || reportPending || !online) return;
    const category = reportReason === "harassment" || reportReason === "sexual" ? "HARASSMENT" : reportReason === "unsafe" ? "SAFETY" : reportReason === "solicitation" || reportReason === "misleading" ? "FRAUD" : "OTHER";
    const details = reportDetail.trim() || reportReasons.find(([value]) => value === reportReason)?.[1] || reportReason;
    const payload = JSON.stringify({ category, urgency: urgentReport ? "P0" : "P1", details });
    const attempt =
      reportAttemptRef.current?.identity === detailLocalIdentity && reportAttemptRef.current.payload === payload
        ? reportAttemptRef.current
        : { identity: detailLocalIdentity, payload, idempotencyKey: crypto.randomUUID(), inFlight: false };
    if (attempt.inFlight) return;
    reportAttemptRef.current = attempt;
    attempt.inFlight = true;
    setReportPending(true);
    setReportError(null);
    try {
      await auth.createReport(
        {
          targetType: "MEETUP",
          meetupId,
          category,
          urgency: urgentReport ? "P0" : "P1",
          details,
          evidenceUploadIds: [],
        },
        attempt.idempotencyKey,
      );
      if (subjectRef.current !== subject || meetupIdRef.current !== meetupId) return;
      reportAttemptRef.current = null;
      reportWasOpened.current = false;
      setReported(true);
      setReportOpen(false);
    } catch (error) {
      if (subjectRef.current !== subject || meetupIdRef.current !== meetupId || error instanceof SessionExpiredError) return;
      setReportError(error instanceof ApiProblemError ? error.problem?.detail ?? "신고를 접수하지 못했어요." : "신고를 접수하지 못했어요.");
    } finally {
      attempt.inFlight = false;
      if (subjectRef.current === subject && meetupIdRef.current === meetupId) setReportPending(false);
    }
  }

  function handleReportExitComplete() {
    if (!detailLocalStateIsCurrent || activeReported) return;
    if (reportWasOpened.current) { reportWasOpened.current = false; reportTriggerRef.current?.focus(); }
  }


  async function joinMeetup() {
    if (!subject || !auth || !currentMeetup?.allowedActions.includes("JOIN") || currentRelation || activeJoinState.result || !online) return;
    const existing = joinAttemptRef.current?.identity === detailLocalIdentity
      ? joinAttemptRef.current
      : { identity: detailLocalIdentity, idempotencyKey: crypto.randomUUID(), inFlight: null };
    joinAttemptRef.current = existing;
    if (existing.inFlight) return;
    setJoinState({ identity: detailLocalIdentity, status: "pending", result: null, error: null });
    const request = auth.joinMeetup(meetupId, existing.idempotencyKey);
    existing.inFlight = request;
    try {
      const result = await request;
      if (subjectRef.current !== subject || meetupIdRef.current !== meetupId) return;
      joinAttemptRef.current = null;
      setJoinState({ identity: detailLocalIdentity, status: "done", result, error: null });
      setLeaveState({ identity: detailLocalIdentity, status: "idle", error: null });
      await loadMeetup();
    } catch (error) {
      if (subjectRef.current !== subject || meetupIdRef.current !== meetupId) return;
      setJoinState({ identity: detailLocalIdentity, status: "error", result: null, error: error instanceof ApiProblemError ? error.problem?.detail ?? "참여를 처리하지 못했어요." : "참여를 처리하지 못했어요." });
      await loadMeetup();
    } finally {
      if (joinAttemptRef.current === existing) existing.inFlight = null;
    }
  }

  async function leaveMeetup() {
    if (!subject || !auth || !currentMeetup || !(currentMeetup.allowedActions.includes("LEAVE") || (currentMeetup.state === "OPEN" && currentRelation === "PARTICIPANT")) || !online) return;
    const existing = leaveAttemptRef.current?.identity === detailLocalIdentity
      ? leaveAttemptRef.current
      : { identity: detailLocalIdentity, inFlight: null };
    leaveAttemptRef.current = existing;
    if (existing.inFlight) return;
    setLeaveState({ identity: detailLocalIdentity, status: "pending", error: null });
    const request = auth.leaveMeetup(meetupId);
    existing.inFlight = request;
    try {
      await request;
      if (subjectRef.current !== subject || meetupIdRef.current !== meetupId) return;
      leaveAttemptRef.current = null;
      setLeaveState({ identity: detailLocalIdentity, status: "done", error: null });
      setJoinState({ identity: detailLocalIdentity, status: "idle", result: null, error: null });
      await loadMeetup();
    } catch (error) {
      if (subjectRef.current !== subject || meetupIdRef.current !== meetupId) return;
      setLeaveState({ identity: detailLocalIdentity, status: "error", error: error instanceof ApiProblemError ? error.problem?.detail ?? "참여 취소를 처리하지 못했어요." : "참여 취소를 처리하지 못했어요." });
      await loadMeetup();
    } finally {
      if (leaveAttemptRef.current === existing) existing.inFlight = null;
    }
  }

  if (!subject) {
    return (
      <ScreenShell bottomSpacing aria-label="로그인 필요">
        <TopNavigation href="/" title="모임 상세" />
        <section className="px-[var(--dimension-x5)] pb-8 pt-12" aria-labelledby="meetup-auth-heading">
          <h2 id="meetup-auth-heading" className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
            로그인하고 모임을 확인해 주세요
          </h2>
          <p className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            모임 정보와 참여 가능 여부는 로그인한 계정의 최신 서버 상태에서만 표시해요.
          </p>
        </section>
        <BottomActionBar>
          <Link className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)]" href={`/auth?next=${encodeURIComponent(`/meetups/${encodedMeetupId}`)}`}>
            휴대전화로 로그인하기
          </Link>
        </BottomActionBar>
      </ScreenShell>
    );
  }

  const detailValues = currentMeetup
    ? [
        {
          label: "시간",
          value: `${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(currentMeetup.startsAt))}–${new Intl.DateTimeFormat("ko-KR", { timeStyle: "short" }).format(new Date(currentMeetup.endsAt))}`,
        },
        { label: "인원", value: `현재 ${currentMeetup.joinedCount}명 · 최소 ${currentMeetup.minimumParticipants}명 · 정원 ${currentMeetup.capacity}명` },
        { label: "비용", value: currentMeetup.cost === 0 ? "무료" : `${currentMeetup.cost.toLocaleString("ko-KR")}원` },
        { label: "음주", value: currentMeetup.alcoholPolicy === "ALLOWED" ? "가능" : "없음" },
        { label: "진행", value: currentMeetup.preparation || currentMeetup.facilitationTemplate || "서버에서 진행 정보를 제공하지 않았어요." },
      ]
    : [];
  const meetupTitle = currentMeetup?.title ?? "";
  const meetupDescription = currentMeetup?.description ?? "";
  const meetupStatus = currentMeetup
    ? currentMeetup.allowedActions.includes("JOIN") && !currentRelation && !activeJoinState.result
      ? "참여 가능한 모임이에요."
      : `현재 상태: ${currentMeetup.state}`
    : "";
  const hasJoinAction = Boolean(currentMeetup?.allowedActions.includes("JOIN") && !currentRelation && !activeJoinState.result);
  const hasLeaveAction = Boolean(currentMeetup?.allowedActions.includes("LEAVE") || (currentMeetup?.state === "OPEN" && currentRelation === "PARTICIPANT"));
  const hasCancelAction = currentMeetup?.allowedActions.includes("CANCEL") ?? false;
  const hasQuorumDecisionAction = currentMeetup?.allowedActions.includes("QUORUM_DECISION") ?? false;
  const hasCheckInAction = currentMeetup?.allowedActions.includes("CHECK_IN") ?? false;
  const authenticatedActionCount =
    Number(hasJoinAction) +
    Number(hasLeaveAction) +
    Number(hasCancelAction) +
    Number(hasQuorumDecisionAction) +
    Number(hasCheckInAction);
  const bottomActionCount = authenticatedActionCount;
  const venueName = currentMeetup?.venue.name?.trim() || null;
  const venueAddress = currentMeetup?.venue.address?.trim() || null;
  const hasAuthorizedVenue = Boolean(venueName || venueAddress);
  return (
    <ScreenShell
      actionCount={bottomActionCount}
      aria-label="모임 상세"
    >
      <TopNavigation
        href="/"
        title="모임 상세"
      />

      <OfflineNotice className="mx-5 mt-5" />

      {authenticatedDetailLoading ? <section className="px-[var(--dimension-x5)] pt-12 text-center" role="status">모임을 불러오는 중이에요.</section> : authenticatedDetailError ? <section className="grid gap-3 px-[var(--dimension-x5)] pt-12 text-center" role="alert"><p>{meetupState.error}</p><button type="button" onClick={() => void loadMeetup()} className="min-h-[44px] border border-[var(--stroke-neutral)] px-3">다시 시도</button></section> : (
        <div className="px-[var(--dimension-x5)] pb-8 pt-7">
          <section aria-labelledby="meetup-title">
          <h2
            id="meetup-title"
            className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]"
          >
            {meetupTitle}
          </h2>
          <p className="m-0 mt-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            {meetupDescription}
          </p>
          <p className="m-0 mt-6 font-display text-[20px] font-normal leading-7 text-[var(--fg-neutral)]">
            {meetupStatus}
          </p>
        </section>
        {activeJoinState.status === "pending" ? <p className="mt-4 text-[length:var(--type-body)] text-[var(--fg-muted)]" role="status">참여를 처리하는 중이에요.</p> : null}
        {activeJoinState.result ? <p className="mt-4 text-[length:var(--type-body)] text-[var(--fg-positive)]" role="status">{activeJoinState.result.state === "JOINED" ? "참여가 완료됐어요." : `대기 목록에 등록됐어요${activeJoinState.result.waitlistPosition ? ` (${activeJoinState.result.waitlistPosition}번째)` : ""}.`}</p> : null}
        {activeJoinState.error ? <section className="mt-4" role="alert"><p>{activeJoinState.error}</p><button type="button" onClick={() => void joinMeetup()} className="min-h-[44px] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2">같은 요청으로 다시 시도</button></section> : null}
        {activeLeaveState.status === "pending" ? <p className="mt-4 text-[length:var(--type-body)] text-[var(--fg-muted)]" role="status">참여 취소를 처리하는 중이에요.</p> : null}
        {activeLeaveState.status === "done" ? <p className="mt-4 text-[length:var(--type-body)] text-[var(--fg-positive)]" role="status">참여를 취소했어요. 서버 상태를 새로 확인했어요.</p> : null}
        {activeLeaveState.error ? <section className="mt-4" role="alert"><p>{activeLeaveState.error}</p><button type="button" onClick={() => void leaveMeetup()} className="min-h-[44px] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2">참여 취소 다시 시도</button></section> : null}

        <dl className="mt-6 border-y border-[var(--stroke-neutral)]">
          {detailValues.map((detail) => (
            <div
              className="grid min-h-[46px] grid-cols-[52px_minmax(0,1fr)] items-center gap-3 border-b border-[var(--stroke-neutral)] last:border-b-0"
              key={detail.label}
            >
              <dt className="text-[length:var(--type-body)] leading-5 text-[var(--fg-muted)]">{detail.label}</dt>
              <dd
                className={`m-0 text-right text-[var(--fg-neutral)] ${
                  detail.label === "시간"
                    ? "font-display text-[length:var(--type-time)] font-normal leading-6"
                    : "text-[length:var(--type-title)] font-semibold leading-5"
                }`}
              >
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex items-start gap-3 rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-3">
          {hasAuthorizedVenue ? (
            <MapPin
              className="mt-0.5 shrink-0 text-[var(--fg-muted)]"
              size={28}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          ) : (
            <LockKeyhole
              className="mt-0.5 shrink-0 text-[var(--fg-muted)]"
              size={28}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          )}
          <div className="min-w-0">
            <p className="m-0 text-[length:var(--type-title)] font-bold leading-5">{hasAuthorizedVenue ? "모임 장소" : "공개 장소"}</p>
            <p className="m-0 mt-1 break-words text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)] [overflow-wrap:anywhere]">
              {hasAuthorizedVenue
                ? [venueName, venueAddress].filter(Boolean).join(" · ")
                : "정확한 장소는 참여 확정 후 공개해요."}
            </p>
          </div>
        </div>

        <ul className="m-0 mt-3 list-none divide-y divide-[var(--stroke-neutral)] p-0">
          <li className="flex min-h-[42px] items-center gap-3">
            <CircleCheck
              className="shrink-0 text-[var(--fg-neutral)]"
              size={24}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="text-[length:var(--type-section)] font-semibold leading-6">본인 인증이 된 사람과 만나요</span>
          </li>
          <li className="flex min-h-[42px] items-center gap-3">
            <MapPin
              className="shrink-0 text-[var(--fg-neutral)]"
              size={24}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="text-[length:var(--type-section)] font-semibold leading-6">공개 장소에서 만나요</span>
          </li>
          <li className="flex min-h-[42px] items-center gap-3">
            <UsersRound
              className="shrink-0 text-[var(--fg-neutral)]"
              size={24}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="text-[length:var(--type-section)] font-semibold leading-6">
              평점 없이 만나요
            </span>
          </li>
        </ul>

          <section className="mt-4 border-t border-[var(--stroke-neutral)] pt-5" aria-labelledby="meetup-safety-heading">
            <h3
              id="meetup-safety-heading"
              className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]"
            >
              안전 도움이 필요한가요?
            </h3>
            <p className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              불편하거나 위험한 상황을 신고하거나 모임 제안자를 차단할 수 있어요.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                ref={reportTriggerRef}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                type="button"
                onClick={openReportDialog}
                aria-haspopup="dialog"
                aria-expanded={activeReportOpen}
              >
                <Flag size={19} strokeWidth={1.8} aria-hidden="true" />
                신고하기
              </button>
              <p className="m-0 flex min-h-[48px] items-center px-3 text-[length:var(--type-body)] leading-5 text-[var(--fg-muted)]">
                제안자 정보가 없어 여기서 차단할 수 없어요.
              </p>
            </div>
            {activeReported ? (
              <div
                className="mt-4 flex items-start gap-2 rounded-[10px] bg-[var(--bg-neutral-weak)] px-3 py-3 text-left"
                id="meetup-report-receipt"
                role="status"
                aria-live="polite"
                tabIndex={-1}
              >
                <ShieldCheck className="mt-0.5 shrink-0 text-[var(--fg-critical)]" size={18} strokeWidth={1.8} aria-hidden="true" />
                <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">
                  신고 내용을 이 화면에 기록했어요. 운영 검토 결과가 확정된 것은 아니에요.
                </p>
              </div>
            ) : null}
          </section>
        </div>
      )}

      <AnimatedDialog
        key={`report:${detailLocalIdentity}`}
        open={activeReportOpen}
        onOpenChange={handleReportOpenChange}
        onExitComplete={handleReportExitComplete}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <AnimatedDialogTitle className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">
          이 모임을 신고할까요?
        </AnimatedDialogTitle>
        <AnimatedDialogDescription className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          신고 사유와 필요한 경우 상세 내용을 남겨 주세요.
        </AnimatedDialogDescription>
        <form className="mt-4" onSubmit={handleReportSubmit}>
          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">신고 사유</legend>
            <div className="space-y-1">
              {reportReasons.map(([value, label]) => (
                <label
                  className="flex min-h-[44px] items-center gap-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]"
                  key={value}
                >
                  <input
                    className="size-5 accent-[var(--fg-neutral)]"
                    type="radio"
                    name="meetup-report-reason"
                    value={value}
                    checked={reportReason === value}
                    onChange={(event) => setReportReason(event.target.value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 flex min-h-[44px] items-center gap-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">
            <input
              className="size-5 accent-[var(--fg-critical)]"
              type="checkbox"
              checked={urgentReport}
              onChange={(event) => setUrgentReport(event.target.checked)}
            />
            긴급한 안전 위협이에요
          </label>
          <p className="m-0 mt-2 text-[12px] leading-4 text-[var(--fg-muted)]">
            신고자 정보는 상대에게 공개되지 않아요. 즉시 위험하면{" "}
            <a className="font-semibold text-[var(--fg-critical)] underline" href="tel:112">112</a>
            {" 또는 "}<a className="font-semibold text-[var(--fg-critical)] underline" href="tel:119">119</a>에 연락하세요.
          </p>
          <label
            className="mt-3 block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]"
            htmlFor="meetup-report-detail"
          >
            상세 내용 (선택)
          </label>
          <textarea
            id="meetup-report-detail"
            className="mt-2 min-h-[80px] w-full resize-y rounded-[10px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] p-3 text-[length:var(--type-body)] leading-[22px] outline-none focus-visible:border-[var(--fg-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]"
            value={reportDetail}
            onChange={(event) => setReportDetail(event.target.value)}
            placeholder="상황을 알려 주세요."
          />
          <div className="mt-3 flex gap-2">
          {reportError ? <p role="alert">{reportError}</p> : null}
            <button
              className="min-h-[48px] flex-1 rounded-[10px] bg-[var(--fg-critical)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              type="submit"
              disabled={!reportReason || reportPending || !online}
            >
              {reportPending ? "신고 접수 중…" : "신고 내용 기록하기"}
            </button>
            <AnimatedDialogClose asChild>
              <button
                className="min-h-[48px] rounded-[10px] px-4 text-[length:var(--type-action)] leading-6 text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                type="button"
              >
                취소
              </button>
            </AnimatedDialogClose>
          </div>
        </form>
      </AnimatedDialog>


      {authenticatedActionCount > 0 ? (
        <BottomActionBar>
          {hasJoinAction ? (
            <button
              type="button"
              onClick={() => void joinMeetup()}
              disabled={activeJoinState.status === "pending" || !online}
              className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            >
              {activeJoinState.status === "pending" ? "참여 처리 중…" : "이 모임에 참여하기"}
            </button>
          ) : null}
          {hasLeaveAction ? (
            <button
              type="button"
              onClick={() => void leaveMeetup()}
              disabled={activeLeaveState.status === "pending" || !online}
              className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-critical)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            >
              {activeLeaveState.status === "pending" ? "참여 취소 처리 중…" : "모임 참여 취소하기"}
            </button>
          ) : null}
          {hasCancelAction ? (
            <Link
              className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href={`/meetups/${encodedMeetupId}/safety-cancel`}
            >
              안전을 위해 모임 취소하기
            </Link>
          ) : null}
          {hasQuorumDecisionAction ? (
            <Link
              className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href={`/meetups/${encodedMeetupId}/quorum-decision`}
            >
              인원 결정하기
            </Link>
          ) : null}
          {hasCheckInAction ? (
            <Link
              className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href={`/meetups/${encodedMeetupId}/check-in`}
            >
              체크인하기
            </Link>
          ) : null}
        </BottomActionBar>
      ) : null}
    </ScreenShell>
  );
}
