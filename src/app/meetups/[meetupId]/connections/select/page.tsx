"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import { useAuthSession } from "@/lib/auth/auth-session-provider";
import type { ConnectionIntentResult, Participant } from "@/lib/api/types";

type LoadState = "loading" | "ready" | "error";

function message(cause: unknown, fallback: string) {
  return cause instanceof ApiProblemError ? cause.problem?.detail ?? fallback : fallback;
}

export default function ConnectionSelectPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params?.meetupId === "string" ? params.meetupId : "";
  const { snapshot, listParticipants, createConnectionIntent } = useAuthSession();
  const accountId = snapshot.status === "authenticated" ? snapshot.user.id : "anonymous";
  const identity = `${accountId}:${meetupId}`;
  const requestRef = useRef(0);
  const identityRef = useRef(identity);
  const [members, setMembers] = useState<Participant[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [appendError, setAppendError] = useState("");
  const [isAppending, setIsAppending] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<ConnectionIntentResult | null>(null);

  identityRef.current = identity;

  const isCurrent = (request: number, requestIdentity: string) => (
    request === requestRef.current && requestIdentity === identityRef.current
  );

  const loadInitial = async (request: number, requestIdentity: string) => {
    if (snapshot.status !== "authenticated" || !meetupId) {
      if (isCurrent(request, requestIdentity)) {
        setLoadState("error");
        setLoadError("로그인 후 참가자를 확인할 수 있어요.");
      }
      return;
    }

    try {
      const page = await listParticipants(meetupId, { limit: 20 });
      if (!isCurrent(request, requestIdentity)) return;
      setMembers(page.items);
      setCursor(page.nextCursor);
      setLoadState("ready");
    } catch (cause) {
      if (!isCurrent(request, requestIdentity)) return;
      setLoadState("error");
      setLoadError(message(cause, "참가자를 불러오지 못했어요."));
    }
  };

  useEffect(() => {
    const request = ++requestRef.current;
    const requestIdentity = identity;

    setMembers([]);
    setCursor(undefined);
    setSelected([]);
    setResult(null);
    setSubmitError("");
    setAppendError("");
    setLoadError("");
    setIsAppending(false);
    setSubmitting(false);
    setLoadState("loading");
    void loadInitial(request, requestIdentity);
    // This generation and identity pair owns every async completion for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, listParticipants, meetupId, snapshot.status]);

  const retryInitial = () => {
    const request = ++requestRef.current;
    const requestIdentity = identity;
    setLoadState("loading");
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

    void listParticipants(meetupId, { cursor: nextCursor, limit: 20 })
      .then((page) => {
        if (!isCurrent(request, requestIdentity)) return;
        setMembers((current) => [
          ...current,
          ...page.items.filter((item) => !current.some((old) => old.userId === item.userId)),
        ]);
        setCursor(page.nextCursor);
      })
      .catch((cause: unknown) => {
        if (!isCurrent(request, requestIdentity)) return;
        setAppendError(message(cause, "참가자를 더 불러오지 못했어요."));
      })
      .finally(() => {
        if (isCurrent(request, requestIdentity)) setIsAppending(false);
      });
  };

  const toggle = (userId: string) => {
    setSelected((current) => {
      if (current.includes(userId)) return current.filter((id) => id !== userId);
      return current.length < 7 ? [...current, userId] : current;
    });
    setResult(null);
  };

  const submit = () => {
    if (submitting || selected.length < 1 || selected.length > 7 || snapshot.status !== "authenticated") return;

    const request = requestRef.current;
    const requestIdentity = identity;
    const targetUserIds = selected;
    setSubmitting(true);
    setSubmitError("");

    void createConnectionIntent(meetupId, { targetUserIds })
      .then((next) => {
        if (isCurrent(request, requestIdentity)) setResult(next);
      })
      .catch((cause: unknown) => {
        if (isCurrent(request, requestIdentity)) {
          setSubmitError(message(cause, "선택을 저장하지 못했어요. 다시 시도해 주세요."));
        }
      })
      .finally(() => {
        if (isCurrent(request, requestIdentity)) setSubmitting(false);
      });
  };

  const visible = snapshot.status === "authenticated"
    ? members.filter((member) => member.state === "CHECKED_IN" && member.userId !== snapshot.user.id)
    : [];
  const matched = result?.results.filter((item) => item.state === "MATCHED") ?? [];

  return (
    <ScreenShell bottomSpacing>
      <TopNavigation href={`/meetups/${encodeURIComponent(meetupId)}`} title={<span>다시 연결하기</span>} />
      <div className="flex flex-1 flex-col px-5 pb-8">
        <h1 className="mt-7 text-xl font-bold">다시 이야기하고 싶은 사람이 있나요?</h1>
        <p>체크인한 참가자만 보여요. PENDING 선택은 상대에게 공개되지 않아요.</p>
        {loadState === "loading" ? <p role="status">참가자를 불러오는 중이에요.</p> : null}
        {loadState === "error" ? (
          <div role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={retryInitial}>다시 시도</button>
          </div>
        ) : null}
        {loadState === "ready" && visible.length === 0 ? <p role="status">선택할 체크인 참가자가 없어요.</p> : null}
        <ul aria-label="체크인한 참가자 목록">
          {visible.map((member) => {
            const checked = selected.includes(member.userId);
            return (
              <li key={member.userId}>
                <button type="button" aria-pressed={checked} onClick={() => toggle(member.userId)}>
                  <span>{member.displayName}</span>
                  {checked ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        {cursor ? <button type="button" disabled={isAppending} onClick={loadMore}>{isAppending ? "더 불러오는 중..." : "더 보기"}</button> : null}
        {appendError ? (
          <div role="alert">
            <p>{appendError}</p>
            <button type="button" onClick={loadMore}>더 보기 재시도</button>
          </div>
        ) : null}
        {submitError ? (
          <div role="alert">
            <p>{submitError}</p>
            <button type="button" onClick={submit}>다시 시도</button>
          </div>
        ) : null}
        {result ? (
          <section role="status" tabIndex={-1}>
            <p>{matched.length ? "상호 연결됐어요." : "선택을 저장했어요. 상대에게 공개되지 않아요."}</p>
            {result.results.map((item) => <p key={item.targetUserId}>{item.state}{item.connectionId ? ` · ${item.connectionId}` : ""}</p>)}
            <Link href="/connections">연결 목록으로</Link>
          </section>
        ) : null}
      </div>
      <BottomActionBar>
        <button type="button" disabled={submitting || selected.length === 0 || Boolean(result)} onClick={submit}>
          {submitting ? "저장 중..." : "선택 완료"}
        </button>
      </BottomActionBar>
    </ScreenShell>
  );
}
