"use client";

import { Info, LockKeyhole } from "lucide-react";
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
import type { Block, BlockPage } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { useOnlineStatus } from "@/lib/ui/online";

type BlockListState = {
  subject: string | null;
  status: "idle" | "loading" | "ready" | "error";
  items: Block[];
  nextCursor?: string;
  error: string | null;
  loadingMore: boolean;
};

type PendingUnblock = {
  subject: string | null;
  block: Block | null;
  error: string | null;
};

type FocusIntent = "count" | "trigger" | null;

function problemMessage(error: unknown, fallback: string) {
  return error instanceof ApiProblemError ? error.problem?.detail ?? fallback : fallback;
}

function createdAt(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? createdAt
    : date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

const emptyListState: BlockListState = {
  subject: null,
  status: "idle",
  items: [],
  error: null,
  loadingMore: false,
};

export default function BlocksPage() {
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  // Session-scoped key: same subject re-login is a fresh session.
  const sessionKey = subject ? `${sessionEpoch}:${subject}` : null;
  const sessionKeyRef = useRef(sessionKey);
  const online = useOnlineStatus();
  const requestRef = useRef(0);
  const deleteRequestRef = useRef<string | null>(null);
  const unblockTriggerRef = useRef<HTMLButtonElement>(null);
  const countHeadingRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<BlockListState>(emptyListState);
  const [pending, setPending] = useState<PendingUnblock>({ subject: null, block: null, error: null });
  const [focusIntent, setFocusIntent] = useState<FocusIntent>(null);

  sessionKeyRef.current = sessionKey;
  const current = state.subject === sessionKey ? state : { ...emptyListState, subject: sessionKey };
  const currentPending = pending.subject === sessionKey ? pending : { subject: sessionKey, block: null, error: null };
  const deleting = deleteRequestRef.current !== null;

  const load = useCallback(async (cursor?: string, append = false) => {
    if (!auth || !sessionKey) return;

    const request = ++requestRef.current;
    setState((old) => ({
      subject: sessionKey,
      status: append ? "ready" : "loading",
      items: append && old.subject === sessionKey ? old.items : [],
      nextCursor: append && old.subject === sessionKey ? old.nextCursor : undefined,
      error: null,
      loadingMore: append,
    }));

    try {
      const page: BlockPage = await auth.listBlocks({ cursor, limit: 20 });
      if (request !== requestRef.current || sessionKeyRef.current !== sessionKey) return;

      setState((old) => ({
        subject: sessionKey,
        status: "ready",
        items: append && old.subject === sessionKey
          ? [...old.items, ...page.items.filter((item) => !old.items.some(({ blockedUserId }) => blockedUserId === item.blockedUserId))]
          : page.items,
        nextCursor: page.nextCursor,
        error: null,
        loadingMore: false,
      }));
    } catch (error) {
      if (request !== requestRef.current || sessionKeyRef.current !== sessionKey || error instanceof SessionExpiredError) return;

      setState((old) => ({
        subject: sessionKey,
        status: append ? "ready" : "error",
        items: append && old.subject === sessionKey ? old.items : [],
        nextCursor: append && old.subject === sessionKey ? old.nextCursor : undefined,
        error: problemMessage(error, "차단 목록을 불러오지 못했어요."),
        loadingMore: false,
      }));
    }
  }, [auth, sessionKey]);

  useEffect(() => {
    requestRef.current += 1;
    deleteRequestRef.current = null;
    setFocusIntent(null);

    if (!sessionKey) {
      setState(emptyListState);
      setPending({ subject: null, block: null, error: null });
      return;
    }

    setPending({ subject: sessionKey, block: null, error: null });
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load, sessionKey]);

  async function unblock() {
    const block = currentPending.block;
    if (!auth || !sessionKey || !block || deleteRequestRef.current) return;
    if (!online) {
      setPending({ subject: sessionKey, block, error: "인터넷 연결이 끊겨 차단을 해제할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요." });
      return;
    }

    const request = `${sessionKey}:${block.blockedUserId}:${crypto.randomUUID()}`;
    deleteRequestRef.current = request;
    setPending({ subject: sessionKey, block, error: null });

    try {
      await auth.deleteBlock(block.blockedUserId);
      if (deleteRequestRef.current !== request || sessionKeyRef.current !== sessionKey) return;

      setState((old) => old.subject !== sessionKey
        ? old
        : { ...old, items: old.items.filter(({ blockedUserId }) => blockedUserId !== block.blockedUserId) });
      setPending({ subject: sessionKey, block: null, error: null });
      setFocusIntent("count");
    } catch (error) {
      if (deleteRequestRef.current !== request || sessionKeyRef.current !== sessionKey || error instanceof SessionExpiredError) return;
      setPending({ subject: sessionKey, block, error: problemMessage(error, "차단을 해제하지 못했어요.") });
    } finally {
      if (deleteRequestRef.current === request) deleteRequestRef.current = null;
    }
  }

  function handleDialogExit() {
    if (focusIntent === "trigger") unblockTriggerRef.current?.focus();
    if (focusIntent === "count") countHeadingRef.current?.focus();
    if (focusIntent) setFocusIntent(null);
  }

  return (
    <ScreenShell className="px-5 pb-8">
      <TopNavigation href="/profile" title="차단 관리" />
      <main>
        <section className="mt-6">
          <div className="flex items-start gap-3 bg-[var(--bg-neutral-weak)] px-4 py-3">
            <Info size={22} aria-hidden="true" />
            <p className="m-0">차단한 계정은 이름과 프로필을 제공하지 않는 서버 계약으로 관리돼요.</p>
          </div>

          <OfflineNotice />
          {sessionKey === null ? <p role="alert">로그인한 뒤 차단 목록을 확인해 주세요.</p> : null}
          {current.status === "loading" ? <p role="status">차단 목록을 불러오는 중이에요.</p> : null}
          {current.status === "error" ? (
            <div role="alert">
              <p>{current.error}</p>
              <button onClick={() => void load()} type="button">다시 시도</button>
            </div>
          ) : null}
          {current.status === "ready" && current.items.length === 0 ? <p role="status">차단한 사람이 없어요.</p> : null}

          <h1 ref={countHeadingRef} tabIndex={-1} className="m-0 mt-4 text-[16px] font-bold leading-6 text-[var(--fg-neutral)] outline-none">차단한 사람 {current.items.length}명</h1>
          <ul className="m-0 mt-3 grid list-none gap-3 p-0">
            {current.items.map((block) => (
              <li key={block.blockedUserId} className="flex items-center gap-2 rounded-2xl border border-[var(--stroke-neutral)] p-3">
                <LockKeyhole className="shrink-0 text-[var(--fg-muted)]" size={18} aria-hidden="true" />
                <span className="min-w-0 flex-1 break-all text-[14px] font-semibold text-[var(--fg-neutral)]">{block.blockedUserId}</span>
                <time dateTime={block.createdAt} className="shrink-0 text-[12px] leading-4 text-[var(--fg-muted)]">{createdAt(block.createdAt)}</time>
                <button
                  type="button"
                  disabled={!online}
                  onClick={(event) => {
                    unblockTriggerRef.current = event.currentTarget;
                    setPending({ subject: sessionKey, block, error: null });
                  }}
                  className="shrink-0 rounded-[8px] border border-[var(--stroke-neutral)] px-3 py-2 text-[13px] font-bold text-[var(--fg-neutral)] disabled:opacity-60"
                >
                  차단 해제
                </button>
              </li>
            ))}
          </ul>

          {current.nextCursor ? (
            <button type="button" disabled={current.loadingMore} onClick={() => void load(current.nextCursor, true)}>
              {current.loadingMore ? "더 불러오는 중…" : "더 보기"}
            </button>
          ) : null}
          {current.status === "ready" && current.error ? (
            <div role="alert">
              <p>{current.error}</p>
              <button type="button" onClick={() => void load(current.nextCursor, true)}>다시 시도</button>
            </div>
          ) : null}
        </section>
      </main>

      <AnimatedDialog
        open={currentPending.block !== null}
        onOpenChange={(open) => {
          if (!open && !deleteRequestRef.current) {
            setPending({ subject: sessionKey, block: null, error: null });
            setFocusIntent("trigger");
          }
        }}
        onExitComplete={handleDialogExit}
      >
        <AnimatedDialogTitle>차단을 해제할까요?</AnimatedDialogTitle>
        <AnimatedDialogDescription>서버가 차단 해제를 완료할 때까지 목록은 유지돼요.</AnimatedDialogDescription>
        {currentPending.error ? <p role="alert">{currentPending.error}</p> : null}
        <div className="flex gap-2">
          <button type="button" disabled={deleting || !online} onClick={() => void unblock()}>
            {deleting ? "차단 해제 중…" : "차단 해제"}
          </button>
          <AnimatedDialogClose asChild>
            <button type="button" disabled={deleting || !online}>취소</button>
          </AnimatedDialogClose>
        </div>
      </AnimatedDialog>
    </ScreenShell>
  );
}
