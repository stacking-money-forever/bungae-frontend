"use client";

import Link from "next/link";
import { CalendarClock, CheckCircle2, ChevronRight, Clock3 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { OfflineNotice } from "@/components/offline-notice";
import { ApiProblemError } from "@/lib/api/client";
import type { MyMeetup, MyMeetupPage } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";

function errorMessage(error: unknown) {
  return error instanceof ApiProblemError ? error.problem?.detail ?? "내 모임을 불러오지 못했어요." : "내 모임을 불러오지 못했어요.";
}

function displayState(state: MyMeetup["state"]) {
  if (state === "OPEN") return "모집 중";
  if (state === "CONFIRMED") return "확정";
  if (state === "COMPLETED") return "완료";
  if (state === "CANCELLED") return "취소";
  return "상태를 확인할 수 없어요";
}

function displayRelation(relation: string) {
  if (!relation.trim()) return "관계 정보 없음";
  if (relation === "HOST") return "내가 만든 모임";
  if (relation === "PARTICIPANT") return "참여 중";
  return `${relation} · 알 수 없는 관계`;
}

function displayStartsAt(startsAt: string) {
  const date = new Date(startsAt);
  return Number.isNaN(date.getTime()) ? "시작 일시를 확인할 수 없어요" : date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

function MeetupRow({ meetup }: { meetup: MyMeetup }) {
  const Icon = meetup.state === "COMPLETED" ? CheckCircle2 : meetup.state === "CANCELLED" ? Clock3 : CalendarClock;
  return <li className="border-b border-[var(--stroke-neutral)]"><Link className="flex min-h-[104px] w-full items-start gap-3 py-3 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px]" href={`/meetups/${encodeURIComponent(meetup.id)}`} aria-label={`${meetup.title}, ${displayState(meetup.state)}, ${displayRelation(meetup.relation)}, ${displayStartsAt(meetup.startsAt)}`}><Icon className="mt-0.5 shrink-0 text-[var(--fg-muted)]" size={22} strokeWidth={1.8} aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block truncate text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">{meetup.title}</span><span className="mt-1 block text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]"><time dateTime={meetup.startsAt}>{displayStartsAt(meetup.startsAt)}</time></span><span className="mt-1 block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">{displayState(meetup.state)} · {displayRelation(meetup.relation)}</span></span><ChevronRight className="mt-0.5 shrink-0 text-[var(--fg-muted)]" size={22} strokeWidth={1.8} aria-hidden="true" /></Link></li>;
}

function MeetupGroup({ id, title, items }: { id: string; title: string; items: MyMeetup[] }) {
  if (items.length === 0) return null;
  return <section aria-labelledby={id}><h2 id={id} className="font-display m-0 mb-2 text-[length:var(--type-section)] font-normal leading-6 text-[var(--fg-neutral)]">{title}</h2><ul className="m-0 list-none p-0">{items.map((meetup) => <MeetupRow key={meetup.id} meetup={meetup} />)}</ul></section>;
}

type MyMeetupsState = {
  sessionKey: string | null;
  status: "idle" | "loading" | "ready" | "error";
  items: MyMeetup[];
  nextCursor?: string;
  error: string | null;
  loadingMore: boolean;
};

const emptyState: MyMeetupsState = { sessionKey: null, status: "idle", items: [], error: null, loadingMore: false };

export default function MyMeetupsSurface() {
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  // Session-scoped key: the same subject logging in again after logout is a
  // fresh UI session, so stale drafts/receipts/errors never render into it.
  const sessionKey = subject ? `${sessionEpoch}:${subject}` : null;
  const sessionKeyRef = useRef(sessionKey);
  const requestRef = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<MyMeetupsState>(emptyState);
  sessionKeyRef.current = sessionKey;

  const current = state.sessionKey === sessionKey ? state : { ...emptyState, sessionKey };
  const appendError = current.status === "ready" && current.error !== null;

  const load = useCallback(async (cursor?: string, append = false) => {
    if (!auth || !sessionKey) return;
    const request = ++requestRef.current;
    setState((previous) => ({
      sessionKey,
      status: append ? "ready" : "loading",
      items: append && previous.sessionKey === sessionKey ? previous.items : [],
      nextCursor: append && previous.sessionKey === sessionKey ? previous.nextCursor : undefined,
      error: null,
      loadingMore: append,
    }));
    try {
      const page: MyMeetupPage = await auth.listMyMeetups({ relation: "ALL", cursor, limit: 20 });
      if (request !== requestRef.current || sessionKeyRef.current !== sessionKey) return;
      setState((previous) => ({
        sessionKey,
        status: "ready",
        items: append && previous.sessionKey === sessionKey ? [...previous.items, ...page.items] : page.items,
        nextCursor: page.nextCursor,
        error: null,
        loadingMore: false,
      }));
    } catch (error) {
      if (request !== requestRef.current || sessionKeyRef.current !== sessionKey || error instanceof SessionExpiredError) return;
      setState((previous) => ({
        sessionKey,
        status: append ? "ready" : "error",
        items: append && previous.sessionKey === sessionKey ? previous.items : [],
        nextCursor: append && previous.sessionKey === sessionKey ? previous.nextCursor : undefined,
        error: errorMessage(error),
        loadingMore: false,
      }));
    }
  }, [auth, sessionKey]);

  useEffect(() => {
    requestRef.current += 1;
    if (!sessionKey) {
      setState(emptyState);
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load, sessionKey]);

  const active = current.items.filter(({ state: itemState }) => itemState !== "COMPLETED" && itemState !== "CANCELLED");
  const finished = current.items.filter(({ state: itemState }) => itemState === "COMPLETED" || itemState === "CANCELLED");
  return <main className="app-viewport"><div className="home-shell"><header className="root-tab-header flex min-h-[76px] shrink-0 items-center px-5"><h1 ref={headingRef} tabIndex={-1} className="font-display m-0 text-[length:var(--type-page-title)] font-normal leading-6 text-[var(--fg-neutral)] outline-none">내 모임</h1></header><div className="flex-1 px-5 pb-[92px] pt-6"><OfflineNotice className="mb-4" />{sessionKey === null ? <p role="alert">로그인한 뒤 내 모임을 확인해 주세요.</p> : null}{current.status === "loading" ? <p role="status">내 모임을 불러오고 있어요.</p> : null}{current.status === "error" ? <div role="alert"><p>{current.error}</p><button type="button" onClick={() => void load()}>다시 시도</button></div> : null}{current.status === "ready" && current.items.length === 0 ? <p>표시할 내 모임이 없어요.</p> : null}<MeetupGroup id="active-meetups-title" title="진행 중" items={active} /><div className="mt-7"><MeetupGroup id="completed-meetups-title" title="완료 및 취소" items={finished} /></div>{appendError ? <div className="mt-4" role="alert"><p>{current.error}</p><button type="button" onClick={() => void load(current.nextCursor, true)}>다시 시도</button></div> : null}{current.nextCursor ? <button className="mt-6 min-h-[44px]" type="button" disabled={current.loadingMore} onClick={() => void load(current.nextCursor, true)}>{current.loadingMore ? "더 불러오는 중…" : "모임 더 보기"}</button> : null}</div></div></main>;
}
