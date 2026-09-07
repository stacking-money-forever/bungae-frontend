"use client";

import { ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { OfflineNotice } from "@/components/offline-notice";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { Meetup, MeetupAllowedAction } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";

type DetailState = {
  identity: string;
  status: "idle" | "loading" | "ready" | "error";
  meetup: Meetup | null;
  error: string | null;
};

function formatSchedule(meetup: Meetup) {
  const startsAt = new Date(meetup.startsAt);
  const endsAt = new Date(meetup.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return "서버가 유효한 일정을 제공하지 않았어요.";
  }

  const date = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(startsAt);
  const endTime = new Intl.DateTimeFormat("ko-KR", { timeStyle: "short" }).format(endsAt);
  return `${date}–${endTime}`;
}

function actionDestination(meetupId: string, action: MeetupAllowedAction) {
  const encodedMeetupId = encodeURIComponent(meetupId);
  switch (action) {
    case "CHECK_IN":
      return { label: "체크인하기", description: "서버가 체크인을 허용했어요.", href: `/meetups/${encodedMeetupId}/check-in` };
    case "CANCEL":
      return { label: "안전을 위해 모임 취소하기", description: "서버가 취소를 허용했어요.", href: `/meetups/${encodedMeetupId}/safety-cancel` };
    case "QUORUM_DECISION":
      return { label: "인원 결정하기", description: "서버가 진행 여부 결정을 허용했어요.", href: `/meetups/${encodedMeetupId}/quorum-decision` };
    case "JOIN":
      return { label: "참여 상태 확인하기", description: "모임 상세에서 실제 참여 요청을 진행해요.", href: `/meetups/${encodedMeetupId}` };
    case "LEAVE":
      return { label: "참여 취소하기", description: "모임 상세에서 실제 참여 취소를 진행해요.", href: `/meetups/${encodedMeetupId}` };
  }
}

export default function MeetupHubPage() {
  const { meetupId: routeMeetupId } = useParams<{ meetupId: string }>();
  const meetupId = typeof routeMeetupId === "string" ? routeMeetupId : "";
  const meetupPath = `/meetups/${encodeURIComponent(meetupId)}`;
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  // Session-scoped identity: the same subject logging in again after logout is
  // a distinct UI session, so late completions from the old session cannot
  // render in the new session.
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  const subjectRef = useRef(subject);
  const epochRef = useRef(sessionEpoch);
  const meetupIdRef = useRef(meetupId);
  const requestRef = useRef(0);
  subjectRef.current = subject;
  epochRef.current = sessionEpoch;
  meetupIdRef.current = meetupId;
  const identity = `${sessionEpoch}:${subject ?? "anonymous"}:${meetupId}`;
  const [detail, setDetail] = useState<DetailState>({ identity: "", status: "idle", meetup: null, error: null });
  const currentDetail = detail.identity === identity ? detail : { identity, status: "idle" as const, meetup: null, error: null };

  const loadMeetup = useCallback(async () => {
    if (!auth || !subject || !meetupId) return;
    const request = ++requestRef.current;
    setDetail({ identity, status: "loading", meetup: null, error: null });
    try {
      const meetup = await auth.getMeetup(meetupId);
      if (requestRef.current !== request || subjectRef.current !== subject || epochRef.current !== sessionEpoch || meetupIdRef.current !== meetupId) return;
      setDetail({ identity, status: "ready", meetup, error: null });
    } catch (error) {
      if (requestRef.current !== request || subjectRef.current !== subject || epochRef.current !== sessionEpoch || meetupIdRef.current !== meetupId || error instanceof SessionExpiredError) return;
      setDetail({
        identity,
        status: "error",
        meetup: null,
        error: error instanceof ApiProblemError ? error.problem?.detail ?? "모임을 불러오지 못했어요." : "모임을 불러오지 못했어요.",
      });
    }
  }, [auth, identity, meetupId, sessionEpoch, subject]);

  useEffect(() => {
    requestRef.current += 1;
    if (!subject) {
      setDetail({ identity, status: "idle", meetup: null, error: null });
      return;
    }
    void loadMeetup();
    return () => {
      requestRef.current += 1;
    };
  }, [identity, loadMeetup, subject]);

  if (!subject) {
    return (
      <ScreenShell bottomSpacing aria-label="로그인 필요">
        <TopNavigation href={meetupPath} title="확정 모임" />
        <section className="px-[var(--dimension-x5)] pb-8 pt-12" aria-labelledby="hub-auth-heading">
          <h2 id="hub-auth-heading" className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
            로그인하고 모임 상태를 확인해 주세요
          </h2>
          <p className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            확정 모임의 일정, 장소, 이용 가능 기능은 로그인한 계정의 최신 서버 상태에서만 표시해요.
          </p>
        </section>
        <BottomActionBar>
          <Link className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)]" href="/auth">
            휴대전화로 로그인하기
          </Link>
        </BottomActionBar>
      </ScreenShell>
    );
  }

  if (currentDetail.status === "loading" || currentDetail.status === "idle") {
    return (
      <ScreenShell bottomSpacing aria-label="확정 모임 불러오는 중">
        <TopNavigation href={meetupPath} title="확정 모임" />
        <p className="px-[var(--dimension-x5)] pt-12 text-center" role="status">모임을 불러오는 중이에요.</p>
      </ScreenShell>
    );
  }

  if (currentDetail.status === "error" || !currentDetail.meetup) {
    return (
      <ScreenShell bottomSpacing aria-label="확정 모임 불러오기 실패">
        <TopNavigation href={meetupPath} title="확정 모임" />
        <section className="grid gap-3 px-[var(--dimension-x5)] pt-12 text-center" role="alert">
          <p className="m-0">{currentDetail.error ?? "모임을 불러오지 못했어요."}</p>
          <button className="min-h-[44px] border border-[var(--stroke-neutral)] px-3" type="button" onClick={() => void loadMeetup()}>
            다시 시도
          </button>
        </section>
      </ScreenShell>
    );
  }

  const meetup = currentDetail.meetup;
  const venueName = meetup.venue.name?.trim() || null;
  const venueAddress = meetup.venue.address?.trim() || null;
  const actionLinks = meetup.allowedActions.map((action) => ({ action, ...actionDestination(meetup.id, action) }));

  return (
    <ScreenShell bottomSpacing aria-label="확정 모임 허브">
      <TopNavigation href={meetupPath} title="확정 모임" />
      <div className="px-[var(--dimension-x5)] pb-8 pt-7">
        <OfflineNotice className="mb-4" />
        <section aria-labelledby="hub-title">
          <h2 id="hub-title" className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
            {meetup.title}
          </h2>
          <p className="m-0 mt-4 font-display text-[length:var(--type-time)] leading-6 text-[var(--fg-neutral)]">
            {formatSchedule(meetup)}
          </p>
          <p className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            현재 {meetup.joinedCount}명 · 최소 {meetup.minimumParticipants}명 · 정원 {meetup.capacity}명
          </p>
        </section>
        <section className="mt-7 rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-4" aria-labelledby="location-title">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 shrink-0 text-[var(--fg-neutral)]" size={28} strokeWidth={1.8} aria-hidden="true" />
            <div className="min-w-0">
              <h3 id="location-title" className="m-0 text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">
                {venueName ?? "장소 정보"}
              </h3>
              <p className="m-0 mt-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
                {venueAddress ?? "정확한 장소는 서버가 이 계정에 공개한 경우에만 표시해요."}
              </p>
            </div>
          </div>
        </section>
        <nav className="mt-6" aria-label="서버가 허용한 모임 기능">
          {actionLinks.length > 0 ? actionLinks.map(({ action, label, description, href }) => (
            <Link
              className="flex min-h-[78px] items-center gap-3 border-b border-[var(--stroke-neutral)] py-3 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href={href}
              key={action}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[length:var(--type-section)] font-bold leading-6 text-[var(--fg-neutral)]">{label}</span>
                <span className="block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">{description}</span>
              </span>
              <ChevronRight className="shrink-0 text-[var(--fg-muted)]" size={24} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          )) : (
            <p className="m-0 border-b border-[var(--stroke-neutral)] py-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              현재 서버가 허용한 모임 기능이 없어요. 모임 상세에서 최신 상태를 확인해 주세요.
            </p>
          )}
        </nav>
      </div>
      <BottomActionBar>
        <Link
          className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-neutral)] ring-1 ring-inset ring-[var(--stroke-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          href={meetupPath}
        >
          모임 상세에서 최신 상태 확인하기
        </Link>
      </BottomActionBar>
    </ScreenShell>
  );
}
