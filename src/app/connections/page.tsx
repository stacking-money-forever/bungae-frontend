"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AnimatedDialog, AnimatedDialogClose, AnimatedDialogDescription, AnimatedDialogTitle } from "@/components/animated-dialog";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import { useAuthSession } from "@/lib/auth/auth-session-provider";
import type { ConnectionPage } from "@/lib/api/types";
import { chromeButtonClassName } from "@/lib/ui/connection-copy";

type Connection = ConnectionPage["items"][number];

function message(cause: unknown, fallback: string) {
  return cause instanceof ApiProblemError ? cause.problem?.detail ?? fallback : fallback;
}

export default function ConnectionsPage() {
  const { snapshot, listConnections, deleteConnection } = useAuthSession();
  const identity = snapshot.status === "authenticated" ? snapshot.user.id : "anonymous";
  const requestRef = useRef(0);
  const identityRef = useRef(identity);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const actionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [items, setItems] = useState<Connection[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [appendError, setAppendError] = useState("");
  const [isAppending, setIsAppending] = useState(false);
  const [pending, setPending] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [status, setStatus] = useState("");

  identityRef.current = identity;

  const isCurrent = (request: number, requestIdentity: string) => (
    request === requestRef.current && requestIdentity === identityRef.current
  );

  const loadInitial = async (request: number, requestIdentity: string) => {
    if (snapshot.status !== "authenticated") {
      if (isCurrent(request, requestIdentity)) {
        setLoading(false);
        setLoadError("로그인 후 연결을 확인할 수 있어요.");
      }
      return;
    }

    try {
      const page = await listConnections({ limit: 20 });
      if (!isCurrent(request, requestIdentity)) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setLoading(false);
    } catch (cause) {
      if (!isCurrent(request, requestIdentity)) return;
      setLoadError(message(cause, "연결을 불러오지 못했어요."));
      setLoading(false);
    }
  };

  useEffect(() => {
    const request = ++requestRef.current;
    const requestIdentity = identity;

    setItems([]);
    setCursor(undefined);
    setLoadError("");
    setAppendError("");
    setDeleteError("");
    setIsAppending(false);
    setDeleting(false);
    setPending(null);
    setStatus("");
    setLoading(true);
    void loadInitial(request, requestIdentity);
    // This generation and identity pair owns every async completion for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, listConnections, snapshot.status]);

  useEffect(() => {
    if (status) titleRef.current?.focus();
  }, [status]);

  const retryInitial = () => {
    const request = ++requestRef.current;
    const requestIdentity = identity;
    setLoading(true);
    setLoadError("");
    void loadInitial(request, requestIdentity);
  };

  const loadMore = () => {
    if (!cursor || isAppending) return;

    const request = requestRef.current;
    const requestIdentity = identity;
    const nextCursor = cursor;
    setIsAppending(true);
    setAppendError("");

    void listConnections({ cursor: nextCursor, limit: 20 })
      .then((page) => {
        if (!isCurrent(request, requestIdentity)) return;
        setItems((current) => [
          ...current,
          ...page.items.filter((item) => !current.some((old) => old.connectionId === item.connectionId)),
        ]);
        setCursor(page.nextCursor);
      })
      .catch((cause: unknown) => {
        if (!isCurrent(request, requestIdentity)) return;
        setAppendError(message(cause, "연결을 더 불러오지 못했어요."));
      })
      .finally(() => {
        if (isCurrent(request, requestIdentity)) setIsAppending(false);
      });
  };

  const end = () => {
    if (!pending || deleting) return;

    const connection = pending;
    const request = requestRef.current;
    const requestIdentity = identity;
    setDeleting(true);
    setDeleteError("");

    void deleteConnection(connection.connectionId)
      .then(() => {
        if (!isCurrent(request, requestIdentity)) return;
        setItems((current) => {
          const index = current.findIndex((item) => item.connectionId === connection.connectionId);
          const nextId = current[index + 1]?.connectionId;
          queueMicrotask(() => (actionRefs.current[nextId] ?? titleRef.current)?.focus());
          return current.filter((item) => item.connectionId !== connection.connectionId);
        });
        setPending(null);
        setStatus(`${connection.counterpart.displayName}님과의 연결을 종료했어요.`);
      })
      .catch((cause: unknown) => {
        if (!isCurrent(request, requestIdentity)) return;
        setDeleteError(message(cause, "연결을 종료하지 못했어요. 다시 시도해 주세요."));
      })
      .finally(() => {
        if (isCurrent(request, requestIdentity)) setDeleting(false);
      });
  };

  return (
    <ScreenShell className="px-5 pb-8">
      <TopNavigation href="/profile" title={<span>연결 목록</span>} />
      <h1>서로 선택한 사람만 연결돼요.</h1>
      <p>연결 한 건의 자세한 화면은 아직 없어요. 상세 확인을 누르면 안내 화면으로 이동해요.</p>
      <h2 ref={titleRef} tabIndex={-1}>연결된 사람 {items.length}명</h2>
      {loading ? <p role="status">연결을 불러오는 중이에요.</p> : null}
      {loadError ? (
        <div role="alert">
          <p>{loadError}</p>
            <button type="button" onClick={retryInitial} className={chromeButtonClassName}>다시 시도</button>
        </div>
      ) : null}
      {!loading && !loadError && items.length === 0 ? <p role="status">아직 연결된 사람이 없어요.</p> : null}
      <ul>
        {items.map((item) => (
          <li key={item.connectionId}>
            <Link
              className="inline-flex min-h-[44px] min-w-0 items-center gap-2 text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href={`/connections/${encodeURIComponent(item.connectionId)}`}
              aria-label={`${item.counterpart.displayName}님 연결 상세`}
            >
              <strong className="min-w-0 truncate">{item.counterpart.displayName}</strong>
              <span className="shrink-0 text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">상세 확인</span>
            </Link>
            <time dateTime={item.matchedAt}>{item.matchedAt}</time>
            <AnimatedDialog
              open={pending?.connectionId === item.connectionId}
              onOpenChange={(open) => setPending(open ? item : null)}
              trigger={(
                <button
                  type="button"
                  className={chromeButtonClassName}
                  ref={(node) => { actionRefs.current[item.connectionId] = node; }}
                  aria-label={`${item.counterpart.displayName}님과 연결 종료`}
                >
                  연결 종료
                </button>
              )}
            >
              <AnimatedDialogTitle>연결을 종료할까요?</AnimatedDialogTitle>
              <AnimatedDialogDescription>이 작업은 서버에서 연결을 삭제한 뒤에만 목록에 반영돼요.</AnimatedDialogDescription>
              <AnimatedDialogClose asChild><button type="button" className={chromeButtonClassName}>취소</button></AnimatedDialogClose>
              <button type="button" className={chromeButtonClassName} disabled={deleting} onClick={end}>{deleting ? "종료 중..." : "연결 종료"}</button>
            </AnimatedDialog>
          </li>
        ))}
      </ul>
      {cursor ? <button className={`${chromeButtonClassName} mt-3 w-full`} type="button" disabled={isAppending} onClick={loadMore}>{isAppending ? "더 불러오는 중..." : "더 보기"}</button> : null}
      {appendError ? (
        <div role="alert">
          <p>{appendError}</p>
          <button className={chromeButtonClassName} type="button" onClick={loadMore}>더 보기 재시도</button>
        </div>
      ) : null}
      {deleteError ? (
        <div role="alert">
          <p>{deleteError}</p>
          <button className={chromeButtonClassName} type="button" disabled={deleting} onClick={end}>다시 시도</button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">{status}</p>
    </ScreenShell>
  );
}
