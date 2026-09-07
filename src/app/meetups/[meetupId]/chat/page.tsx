"use client";

import { ListChecks, MoreHorizontal, RefreshCw, ShieldCheck } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConversationComposer } from "@/components/conversation-composer";
import { ConversationMessageList } from "@/components/conversation-message-list";
import { NewMessagesBadge } from "@/components/new-messages-badge";
import { OfflineNotice } from "@/components/offline-notice";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { MessagePage } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { identityKey } from "@/lib/ui/async-state";
import { applyViewTransition, initialState, type ConversationAction, type ConversationViewState } from "@/lib/ui/conversation-state";
import { useOnlineStatus } from "@/lib/ui/online";

/**
 * Group chat for a meetup. The only group-chat transports in this build are
 * the HTTP list and create methods (docs/API_CONTRACT.md section 9). No
 * realtime receive strategy is implemented, so the screen labels receiving as
 * unavailable and offers a manual refresh; polling/SSE/WebSocket are never
 * started here.
 */

function problemMessage(error: unknown, fallback: string) {
  return error instanceof ApiProblemError ? error.problem?.detail ?? fallback : fallback;
}

export default function MeetupChatPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "";
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  const sessionKey = `${sessionEpoch}:${subject ?? "anonymous"}`;
  const online = useOnlineStatus();
  const reduceMotion = useReducedMotion();
  const routeKey = `meetup:${meetupId}`;
  const viewKey = identityKey({ sessionEpoch, subject, routeKey });

  const [state, setState] = useState<ConversationViewState>(() => initialState());
  const [draft, setDraft] = useState("");
  const [appending, setAppending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTargeted, setGuideTargeted] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const guideRef = useRef<HTMLElement>(null);
  const listSectionRef = useRef<HTMLElement>(null);
  const atBottomRef = useRef(true);
  const requestRef = useRef(0);
  const draftKeyRef = useRef<{ text: string; key: string } | null>(null);
  const sendInFlightRef = useRef(false);
  const lastAcknowledgedIdRef = useRef<string | null>(null);
  const sessionKeyRef = useRef(sessionKey);
  sessionKeyRef.current = sessionKey;

  // Render-time staleness: prior conversation state/draft never shows for a
  // new session or a different conversation.
  const stale = state.sessionKey !== sessionKey;
  const viewState = stale ? { ...initialState(), sessionKey } : state;
  const viewDraft = stale ? "" : draft;

  const dispatch = useCallback((action: ConversationAction) => {
    setState((previous) => {
      if (action.type === "reset") return applyViewTransition(previous, action);
      if (previous.sessionKey !== sessionKeyRef.current) return previous;
      return applyViewTransition(previous, action);
    });
  }, []);

  const load = useCallback(async (cursor?: string, append = false) => {
    if (!auth || !subject || !meetupId) return;
    const request = ++requestRef.current;
    const requestSession = sessionKeyRef.current;
    if (!append) {
      dispatch({ type: "history-loading" });
    } else {
      setAppending(true);
    }
    try {
      const page: MessagePage = await auth.listMeetupMessages(meetupId, { cursor, limit: 20 });
      if (request !== requestRef.current || sessionKeyRef.current !== requestSession) return;
      dispatch({ type: "history-ready", page, append, dedupe: true });
    } catch (error) {
      if (request !== requestRef.current || sessionKeyRef.current !== requestSession || error instanceof SessionExpiredError) return;
      const message = problemMessage(error, append ? "이전 메시지를 불러오지 못했어요." : "메시지를 불러오지 못했어요.");
      dispatch({ type: append ? "append-error" : "history-error", message });
    } finally {
      if (append && request === requestRef.current) setAppending(false);
    }
  }, [auth, dispatch, meetupId, subject]);

  // Identity change (session epoch, subject, or conversation): wipe private
  // state, draft, keys, anchors, and load the fresh history.
  useEffect(() => {
    requestRef.current += 1;
    draftKeyRef.current = null;
    sendInFlightRef.current = false;
    lastAcknowledgedIdRef.current = null;
    setDraft("");
    setAppending(false);
    setManualRefreshing(false);
    atBottomRef.current = true;
    setMenuOpen(false);
    setGuideOpen(false);
    setGuideTargeted(false);
    setState({ ...initialState(), sessionKey });
    const section = listSectionRef.current;
    if (section) section.scrollTop = 0;
    if (!subject) return;
    void load();
    return () => {
      requestRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, subject]);

  useEffect(() => {
    // Realtime is unavailable here; the access gate is a presentation state
    // with no transport behind it.
    dispatch({ type: "access-allowed" });
  }, [dispatch]);

  const openGuideFromHash = useCallback(() => {
    const targeted = window.location.hash === "#guide";
    setGuideTargeted(targeted);
    if (targeted) setGuideOpen(true);
  }, []);

  useEffect(() => {
    openGuideFromHash();
    window.addEventListener("hashchange", openGuideFromHash);
    return () => window.removeEventListener("hashchange", openGuideFromHash);
  }, [openGuideFromHash]);

  useEffect(() => {
    if (!guideOpen || !guideTargeted) return;
    guideRef.current?.focus({ preventScroll: true });
    guideRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }, [guideOpen, guideTargeted, reduceMotion]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!auth || !subject || !meetupId || trimmed.length < 1 || trimmed.length > 2000) return;
    if (sendInFlightRef.current) return;
    const request = ++requestRef.current;
    const requestSession = sessionKeyRef.current;
    const previousKey = draftKeyRef.current;
    const key = previousKey?.text === trimmed ? previousKey.key : crypto.randomUUID();
    draftKeyRef.current = { text: trimmed, key };
    sendInFlightRef.current = true;
    dispatch({ type: "send-submitting" });
    try {
      const created = await auth.createMeetupMessage(meetupId, trimmed, key);
      if (request !== requestRef.current || sessionKeyRef.current !== requestSession) return;
      lastAcknowledgedIdRef.current = created.id;
      dispatch({ type: "send-acknowledged", message: created });
      setDraft("");
      draftKeyRef.current = null;
    } catch (error) {
      if (request !== requestRef.current || sessionKeyRef.current !== requestSession || error instanceof SessionExpiredError) return;
      dispatch({ type: "send-failed", message: problemMessage(error, "메시지를 보내지 못했어요.") });
    } finally {
      if (request === requestRef.current) sendInFlightRef.current = false;
    }
  }, [auth, dispatch, meetupId, subject]);

  function toggleGuide() {
    if (guideOpen && window.location.hash === "#guide") {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      setGuideTargeted(false);
    }
    setGuideOpen((open) => !open);
  }

  const refresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await load();
    } finally {
      setManualRefreshing(false);
    }
  }, [load]);

  const historyPhase = viewState.history;
  const ready = historyPhase.status === "ready";
  const readyHistory = ready ? historyPhase : null;
  const messages = readyHistory ? readyHistory.items : [];
  const loadError = historyPhase.status === "error" ? historyPhase.message : null;
  const nextCursor = readyHistory ? readyHistory.nextCursor : undefined;
  const loadingMore = appending || manualRefreshing;
  const sending = viewState.send.status === "submitting";
  const sendDisabled = !subject || !online || historyPhase.status !== "ready";
  const disabledReason = !subject
    ? "로그인한 뒤 메시지를 보낼 수 있어요."
    : !online
      ? "인터넷 연결을 확인한 뒤 보낼 수 있어요."
      : "메시지를 불러온 뒤 보낼 수 있어요.";
  const sendErrorMessage = viewState.send.status === "failed" ? viewState.send.message : null;
  const hasMessages = readyHistory !== null && messages.length > 0;

  // New-message presentation: when a committed list grows with messages the
  // reader has not seen, pin to the newest while at the bottom and otherwise
  // present the count. Only the newest item matters here: the 201 send append
  // is the reader's own message (already acknowledged), so it never counts.
  const listIdentity = readyHistory ? `${readyHistory.items.length}:${readyHistory.items.length > 0 ? readyHistory.items[readyHistory.items.length - 1].id : ""}` : null;
  const seenListRef = useRef<string | null>(null);
  const newestIdRef = useRef<string | null>(null);
  const pendingNewCountRef = useRef(0);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    if (listIdentity === null) return;
    const newestId = listIdentity.split(":")[1] ?? null;
    if (seenListRef.current === null) {
      // First committed list is the baseline; never counts as "new".
      seenListRef.current = listIdentity;
      newestIdRef.current = newestId;
      return;
    }
    if (seenListRef.current === listIdentity) return;
    const previousNewest = newestIdRef.current;
    newestIdRef.current = newestId;
    seenListRef.current = listIdentity;
    if (previousNewest === null || newestIdRef.current === previousNewest) return;
    if (newestIdRef.current === lastAcknowledgedIdRef.current) {
      // The reader's own acknowledged 201 send is already presented in the
      // composer outcome; never count it as a new incoming message.
      return;
    }
    const section = listSectionRef.current;
    const atBottom = section ? section.scrollHeight - section.scrollTop - section.clientHeight <= 48 : true;
    if (atBottom && section) {
      if (typeof section.scrollTo === "function") {
        section.scrollTo({ top: section.scrollHeight });
      } else {
        section.scrollTop = section.scrollHeight;
      }
      setNewCount(0);
    } else {
      pendingNewCountRef.current += 1;
      setNewCount(pendingNewCountRef.current);
    }
  }, [listIdentity]);

  const jumpToLatest = () => {
    const section = listSectionRef.current;
    if (!section) return;
    if (typeof section.scrollTo === "function") {
      section.scrollTo({ top: section.scrollHeight });
    } else {
      section.scrollTop = section.scrollHeight;
    }
    pendingNewCountRef.current = 0;
    setNewCount(0);
    seenListRef.current = null;
    newestIdRef.current = null;
  };

  return (
    <ScreenShell className="min-h-[100svh]" aria-label="그룹 채팅">
      <TopNavigation
        href={`/meetups/${encodeURIComponent(meetupId)}`}
        title={<span className="font-display text-[length:var(--type-page-title)] font-normal leading-6 text-[var(--fg-neutral)]">그룹 채팅</span>}
        trailing={(
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            aria-label="채팅 메뉴 열기"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal size={24} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
        className="border-b border-[var(--stroke-neutral)] px-4"
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <section className="shrink-0 px-4 pt-3" aria-label="그룹 채팅 안내">
          <div className="flex items-center gap-3 bg-[var(--bg-layer-floating)] px-4 py-3">
            <ShieldCheck className="shrink-0 text-[var(--fg-neutral)]" size={24} strokeWidth={1.8} aria-hidden="true" />
            <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">확정 참가자만 볼 수 있는 그룹 채팅이에요.</p>
          </div>
          {menuOpen ? (
            <div className="border-t border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 py-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              <p className="m-0">실시간 수신은 아직 제공되지 않아요. 새 메시지는 아래에서 직접 새로고침해 주세요.</p>
              <p className="m-0 mt-1">메시지 신고 기능은 이 계약에서 제공되지 않아요.</p>
            </div>
          ) : null}
        </section>
        <OfflineNotice className="mx-4 mt-2" />
        <section
          ref={listSectionRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-5"
          aria-label="그룹 메시지"
          onScroll={() => {
            const section = listSectionRef.current;
            if (!section) return;
            atBottomRef.current = section.scrollHeight - section.scrollTop - section.clientHeight <= 48;
          }}
        >
          {subject === null ? <p role="alert" className="m-0">로그인한 뒤 그룹 채팅을 확인해 주세요.</p> : null}
          {!subject ? null : historyPhase.status === "loading" ? <p role="status" className="m-0">메시지를 불러오고 있어요.</p> : null}
          {!subject ? null : loadError ? (
            <div role="alert" className="m-0 grid gap-2">
              <p className="m-0">{loadError}</p>
              <button type="button" className="min-h-[44px] w-fit px-3 text-[var(--fg-neutral)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" disabled={!online} onClick={() => void load()}>다시 시도</button>
            </div>
          ) : null}
          {!subject ? null : readyHistory !== null && messages.length === 0 ? (
            <div role="status" className="m-0 grid justify-items-center gap-2 text-center">
              <p className="m-0">표시할 메시지가 없어요.</p>
              <button type="button" className="inline-flex min-h-[44px] items-center gap-2 px-3 text-[var(--fg-muted)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" onClick={() => void refresh()} disabled={!online || loadingMore}><RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" />{loadingMore ? "새로고침 중…" : "새 메시지 확인"}</button>
            </div>
          ) : null}
          {!subject ? null : hasMessages ? (
            <ConversationMessageList
              messages={messages}
              currentUserId={subject}
              onLoadOlder={nextCursor ? (() => void load(nextCursor, true)) : null}
              loadingOlder={appending}
              appendError={viewState.appendError}
            />
          ) : null}
          {!subject ? null : hasMessages && newCount > 0 ? (
            <div className="sticky bottom-2 z-1 mt-1 flex justify-center">
              <NewMessagesBadge count={newCount} onShow={jumpToLatest} disabled={!online} />
            </div>
          ) : null}
          {!subject ? null : hasMessages ? (
            <div className="mt-4 flex justify-center">
              <button type="button" className="inline-flex min-h-[44px] items-center gap-2 px-3 text-[var(--fg-muted)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" onClick={() => void refresh()} disabled={!online || loadingMore}><RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" />{loadingMore ? "새로고침 중…" : "새 메시지 확인"}</button>
            </div>
          ) : null}
        </section>
        <footer className="shrink-0 space-y-2 border-t border-[var(--stroke-neutral)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
          {guideOpen ? (
            <section
              ref={guideRef}
              id="guide"
              tabIndex={-1}
              className="chat-content-reveal border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 py-3 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              aria-label="첫 10분 진행 가이드"
            >
              <h2 className="m-0 text-[length:var(--type-section)] font-bold leading-6 text-[var(--fg-neutral)]">첫 10분 진행 가이드</h2>
              <ol className="m-0 mt-2 list-decimal space-y-1 pl-5 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
                <li>서로의 이름과 오늘 기대하는 것을 짧게 소개해요.</li>
                <li>첫 활동과 종료 시각을 함께 확인해요.</li>
              </ol>
            </section>
          ) : null}
          <button
            type="button"
            className="flex min-h-[52px] w-full items-center gap-3 bg-[var(--bg-layer-floating)] px-4 text-left focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            aria-expanded={guideOpen}
            onClick={toggleGuide}
          >
            <ListChecks className="shrink-0 text-[var(--fg-neutral)]" size={24} strokeWidth={1.8} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--type-action)] leading-6 text-[var(--fg-neutral)]">첫 10분 진행 가이드</span>
              <span className="block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">처음 만나도 어색하지 않게 시작해요</span>
            </span>
          </button>
          {sendErrorMessage ? <p role="alert" className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-critical)]">{sendErrorMessage}</p> : null}
          {viewState.send.status === "failed" ? <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">입력은 그대로 유지돼요. 다시 시도해 주세요.</p> : null}
          {viewState.send.status === "outcome-unknown" ? <p role="alert" className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">보냈는지 확인할 수 없어요. 같은 메시지를 다시 보내면 중복될 수 있어요.</p> : null}
          <ConversationComposer
            draft={viewDraft}
            onDraftChange={(next) => {
              setDraft(next);
              if (draftKeyRef.current?.text !== next.trim()) draftKeyRef.current = null;
            }}
            onSend={(text) => void send(text)}
            disabled={sendDisabled || sending}
            disabledReason={disabledReason}
          />
        </footer>
      </div>
    </ScreenShell>
  );
}
