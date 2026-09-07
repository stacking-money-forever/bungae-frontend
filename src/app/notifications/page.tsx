"use client";

import { CheckCheck, CircleAlert, CircleCheck, ChevronRight, Megaphone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { PushSettingsCard } from "@/components/push-settings-card";
import { OfflineNotice } from "@/components/offline-notice";
import { ApiProblemError } from "@/lib/api/client";
import type { Notification, NotificationPage } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { useOnlineStatus } from "@/lib/ui/online";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiProblemError ? error.problem?.detail ?? fallback : fallback;
}

const TYPE_LABELS: Record<string, string> = {
  JOINED: "참여 신청이 완료됐어요",
  WAITLISTED: "대기 신청이 완료됐어요",
  QUORUM_MET: "최소 인원이 모였어요",
  QUORUM_DECISION_REQUIRED: "진행 여부 결정이 필요해요",
  QUORUM_PROCEED: "모임이 진행되기로 했어요",
  MEETUP_CANCELLED: "모임이 취소됐어요",
  WAITLIST_PROMOTED: "대기하던 모임에 참여할 수 있게 됐어요",
  STARTS_IN_60_MIN: "모임이 1시간 뒤 시작해요",
  CHECK_IN_OPEN: "체크인이 시작됐어요",
  PLACE_CHANGED: "장소가 변경됐어요",
  REPORT_STATUS_CHANGED: "신고 처리 상태가 변경됐어요",
  CONNECTION_MATCHED: "상호 연결됐어요",
};

function typeLabel(type: string) {
  if (!type.trim()) return "알림";
  return TYPE_LABELS[type] ?? "알 수 없는 유형의 알림이에요";
}

function formattedTime(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? "발생 시각을 확인할 수 없어요" : date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

type ListState = {
  sessionKey: string | null;
  status: "idle" | "loading" | "ready" | "error";
  items: Notification[];
  nextCursor?: string;
  error: string | null;
  loadingMore: boolean;
};

type MutationState = {
  sessionKey: string | null;
  pendingId: string | null;
  readAllPending: boolean;
  error: string | null;
};

const emptyListState: ListState = { sessionKey: null, status: "idle", items: [], error: null, loadingMore: false };
const emptyMutationState: MutationState = { sessionKey: null, pendingId: null, readAllPending: false, error: null };

export default function NotificationsSurface() {
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  // Session-scoped key: the same subject logging in again after logout is a
  // fresh UI session, so stale lists/receipts/errors never render into it.
  const sessionKey = subject ? `${sessionEpoch}:${subject}` : null;
  const sessionKeyRef = useRef(sessionKey);
  const online = useOnlineStatus();
  const listRequestRef = useRef(0);
  const mutationRequestRef = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [list, setList] = useState<ListState>(emptyListState);
  const [mutation, setMutation] = useState<MutationState>(emptyMutationState);
  sessionKeyRef.current = sessionKey;

  const currentList = list.sessionKey === sessionKey ? list : { ...emptyListState, sessionKey };
  const currentMutation = mutation.sessionKey === sessionKey ? mutation : { ...emptyMutationState, sessionKey };
  const appendError = currentList.status === "ready" && currentList.error !== null;

  const load = useCallback(async (cursor?: string, append = false) => {
    if (!auth || !sessionKey) return;
    const request = ++listRequestRef.current;
    setList((previous) => ({
      sessionKey,
      status: append ? "ready" : "loading",
      items: append && previous.sessionKey === sessionKey ? previous.items : [],
      nextCursor: append && previous.sessionKey === sessionKey ? previous.nextCursor : undefined,
      error: null,
      loadingMore: append,
    }));
    try {
      const page: NotificationPage = await auth.listNotifications({ cursor, limit: 20 });
      if (request !== listRequestRef.current || sessionKeyRef.current !== sessionKey) return;
      setList((previous) => ({
        sessionKey,
        status: "ready",
        items: append && previous.sessionKey === sessionKey ? [...previous.items, ...page.items] : page.items,
        nextCursor: page.nextCursor,
        error: null,
        loadingMore: false,
      }));
    } catch (error) {
      if (request !== listRequestRef.current || sessionKeyRef.current !== sessionKey || error instanceof SessionExpiredError) return;
      setList((previous) => ({
        sessionKey,
        status: append ? "ready" : "error",
        items: append && previous.sessionKey === sessionKey ? previous.items : [],
        nextCursor: append && previous.sessionKey === sessionKey ? previous.nextCursor : undefined,
        error: errorMessage(error, "알림을 불러오지 못했어요."),
        loadingMore: false,
      }));
    }
  }, [auth, sessionKey]);

  useEffect(() => {
    listRequestRef.current += 1;
    mutationRequestRef.current = null;
    if (!sessionKey) {
      setList(emptyListState);
      setMutation(emptyMutationState);
      return;
    }
    setMutation({ sessionKey, pendingId: null, readAllPending: false, error: null });
    headingRef.current?.focus({ preventScroll: true });
    void load();
    return () => {
      listRequestRef.current += 1;
    };
  }, [load, sessionKey]);

  async function markRead(item: Notification) {
    const request = sessionKey ? `${sessionKey}:${item.notificationId}` : null;
    if (!auth || !sessionKey || !request || item.state === "READ") return;
    if (currentMutation.pendingId || currentMutation.readAllPending || mutationRequestRef.current) return;
    if (!online) {
      setMutation({ sessionKey, pendingId: null, readAllPending: false, error: "인터넷 연결이 끊겨 읽음으로 표시할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요." });
      return;
    }
    mutationRequestRef.current = request;
    setMutation({ sessionKey, pendingId: item.notificationId, readAllPending: false, error: null });
    try {
      const updated = await auth.markNotificationRead(item.notificationId, item.version);
      if (mutationRequestRef.current !== request || sessionKeyRef.current !== sessionKey) return;
      setList((previous) => previous.sessionKey !== sessionKey ? previous : { ...previous, items: previous.items.map((current) => current.notificationId === updated.notificationId ? updated : current) });
      setMutation({ sessionKey, pendingId: null, readAllPending: false, error: null });
    } catch (error) {
      if (mutationRequestRef.current !== request || sessionKeyRef.current !== sessionKey || error instanceof SessionExpiredError) return;
      setMutation({ sessionKey, pendingId: null, readAllPending: false, error: errorMessage(error, "알림을 읽음으로 표시하지 못했어요.") });
      if (error instanceof ApiProblemError && error.status === 409) void load();
    } finally {
      if (mutationRequestRef.current === request) mutationRequestRef.current = null;
    }
  }

  async function markAllRead() {
    const request = sessionKey ? `${sessionKey}:all` : null;
    if (!auth || !sessionKey || !request) return;
    if (currentMutation.pendingId || currentMutation.readAllPending || mutationRequestRef.current) return;
    if (!currentList.items.some(({ state }) => state === "UNREAD")) return;
    if (!online) {
      setMutation({ sessionKey, pendingId: null, readAllPending: false, error: "인터넷 연결이 끊겨 모두 읽기 처리할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요." });
      return;
    }
    mutationRequestRef.current = request;
    setMutation({ sessionKey, pendingId: null, readAllPending: true, error: null });
    try {
      await auth.markAllNotificationsRead();
      if (mutationRequestRef.current !== request || sessionKeyRef.current !== sessionKey) return;
      setMutation({ sessionKey, pendingId: null, readAllPending: false, error: null });
      await load();
    } catch (error) {
      if (mutationRequestRef.current !== request || sessionKeyRef.current !== sessionKey || error instanceof SessionExpiredError) return;
      setMutation({ sessionKey, pendingId: null, readAllPending: false, error: errorMessage(error, "모든 알림을 읽음으로 표시하지 못했어요.") });
    } finally {
      if (mutationRequestRef.current === request) mutationRequestRef.current = null;
    }
  }

  const unreadCount = currentList.items.filter(({ state }) => state === "UNREAD").length;
  return <main className="app-viewport"><div className="home-shell"><header className="root-tab-header flex min-h-[76px] shrink-0 items-center justify-between px-5"><h1 ref={headingRef} tabIndex={-1} className="font-display m-0 text-[length:var(--type-page-title)] font-normal leading-6 tracking-[-0.04em] text-[var(--fg-neutral)] outline-none">알림</h1><button type="button" className="group inline-flex min-h-[44px] items-center px-1 text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-default disabled:text-[var(--fg-muted)]" onClick={() => void markAllRead()} disabled={unreadCount === 0 || currentMutation.pendingId !== null || currentMutation.readAllPending || !online} aria-label={unreadCount === 0 ? "모든 알림을 읽었어요" : "모든 알림 읽기"}><span className="root-header-action__surface group-disabled:bg-transparent"><CheckCheck size={14} strokeWidth={1.8} aria-hidden="true" />{currentMutation.readAllPending ? "처리 중…" : "모두 읽기"}</span></button></header><div className="flex-1 px-5 pb-[100px]"><OfflineNotice className="mb-4" />{sessionKey === null ? <p role="alert">로그인한 뒤 알림을 확인해 주세요.</p> : null}{currentList.status === "loading" ? <p role="status">알림을 불러오고 있어요.</p> : null}{currentList.status === "error" ? <div role="alert"><p>{currentList.error}</p><button type="button" onClick={() => void load()}>다시 시도</button></div> : null}<section aria-labelledby="activity-title"><h2 id="activity-title" className="font-display mb-3 text-[length:var(--type-section)] font-normal leading-6 text-[var(--fg-neutral)]">알림 목록</h2>{currentList.status === "ready" && currentList.items.length === 0 ? <p>표시할 알림이 없어요.</p> : null}<ul className="m-0 list-none p-0">{currentList.items.map((item) => <li key={item.notificationId} className="flex min-h-[74px] items-start gap-3 border-b border-[var(--stroke-neutral)] py-3"><span className="mt-1 shrink-0 text-[var(--fg-muted)]" aria-hidden="true">{item.state === "READ" ? <CircleCheck size={22} /> : <CircleAlert size={22} />}</span><span className="min-w-0 flex-1"><span className={`block text-[length:var(--type-title)] leading-5 text-[var(--fg-neutral)] ${item.state === "UNREAD" ? "font-bold" : "font-normal"}`}>{typeLabel(item.type)}</span><span className="mt-1 block text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">내용은 이 알림 계약에서 제공되지 않아요.</span><time className="mt-1 block text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]" dateTime={item.createdAt}>{formattedTime(item.createdAt)}</time><span className="mt-1 block text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">{item.state === "READ" ? "읽음" : "읽지 않음"}</span></span>{item.state === "UNREAD" ? <button type="button" className="min-h-[44px] shrink-0 text-[length:var(--type-meta)] font-bold text-[var(--fg-neutral)]" disabled={!online || currentMutation.pendingId !== null || currentMutation.readAllPending} onClick={() => void markRead(item)} aria-label={`${typeLabel(item.type)} 읽음으로 표시`}>{currentMutation.pendingId === item.notificationId ? "처리 중…" : "읽음으로 표시"}</button> : null}</li>)}</ul>{currentList.nextCursor ? <button className="mt-6 min-h-[44px]" type="button" disabled={currentList.loadingMore} onClick={() => void load(currentList.nextCursor, true)}>{currentList.loadingMore ? "더 불러오는 중…" : "알림 더 보기"}</button> : null}{appendError ? <div className="mt-4" role="alert"><p>{currentList.error}</p><button type="button" onClick={() => void load(currentList.nextCursor, true)}>다시 시도</button></div> : null}{currentMutation.error ? <p role="alert">{currentMutation.error}</p> : null}</section><section className="mt-7" aria-labelledby="notification-settings-title"><h2 id="notification-settings-title" className="font-display mb-3 text-[length:var(--type-section)] font-normal leading-6 text-[var(--fg-neutral)]">알림 설정</h2><PushSettingsCard dependencies={auth?.pushDependencies} /><Link href="/profile" className="flex min-h-[68px] w-full items-center gap-3 border-b border-[var(--stroke-neutral)] py-2 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px]" aria-label="마케팅 알림 관리. 별도 동의가 필요해요"><Megaphone className="shrink-0 text-[var(--fg-muted)]" size={22} strokeWidth={1.8} aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block text-[length:var(--type-title)] leading-5 text-[var(--fg-neutral)]">마케팅 알림 관리</span><span className="mt-1 block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">별도 동의가 필요해요</span></span><ChevronRight className="shrink-0 text-[var(--fg-muted)]" size={22} strokeWidth={1.8} aria-hidden="true" /></Link></section></div></div></main>;
}
