"use client";

import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { OfflineNotice } from "@/components/offline-notice";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type {
  ActionReceipt,
  FeedbackRequest,
  FeedbackScore,
  ImpressionRequest,
  ImpressionTag,
  NextIntentType,
  Participant,
} from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { useOnlineStatus } from "@/lib/ui/online";

const scoreOptions: FeedbackScore[] = [1, 2, 3, 4, 5];
const impressionTags: Array<{ value: ImpressionTag; label: string }> = [
  { value: "KIND", label: "친절하게 대했어요" },
  { value: "PUNCTUAL", label: "시간을 잘 지켰어요" },
  { value: "ENGAGED", label: "활발하게 참여했어요" },
  { value: "RESPECTFUL", label: "서로를 존중했어요" },
];
const nextIntentOptions: Array<{ value: NextIntentType; label: string }> = [
  { value: "SAME_GROUP", label: "같은 사람들과 다시 만나기" },
  { value: "SAME_ACTIVITY_NEW_PEOPLE", label: "같은 활동을 새로운 사람들과 하기" },
  { value: "DIFFERENT_ACTIVITY", label: "다른 활동 해보기" },
];
const questions = [
  { id: "expectationMatch", label: "기대와 실제가 얼마나 비슷했나요?" },
  { id: "feltSafe", label: "얼마나 안전하게 느꼈나요?" },
  { id: "facilitationComfort", label: "진행이 얼마나 편안했나요?" },
  { id: "wouldUseAgain", label: "다음에도 벙개를 이용하고 싶나요?" },
] as const;

type FeedbackField = (typeof questions)[number]["id"];
type MutationStatus = "idle" | "pending" | "error" | "conflict" | "success";
type FeedbackState = {
  identity: string;
  answers: Partial<Record<FeedbackField, FeedbackScore>>;
  privateComment: string;
  status: MutationStatus;
  error: string | null;
  receipt: ActionReceipt | null;
};
type ImpressionState = {
  identity: string;
  tagsByUserId: Record<string, ImpressionTag[]>;
  status: MutationStatus;
  error: string | null;
  receipt: ActionReceipt | null;
};
type NextIntentState = {
  identity: string;
  type: NextIntentType | null;
  status: MutationStatus;
  error: string | null;
  receipt: ActionReceipt | null;
};
type ParticipantState = {
  identity: string;
  members: Participant[];
  nextCursor?: string;
  status: "idle" | "loading" | "ready" | "error" | "appending";
  error: string | null;
};

function problemMessage(error: unknown, fallback: string) {
  if (error instanceof ApiProblemError && error.problem?.detail) return error.problem.detail;
  return fallback;
}

function emptyFeedback(identity: string): FeedbackState {
  return { identity, answers: {}, privateComment: "", status: "idle", error: null, receipt: null };
}

function emptyImpressions(identity: string): ImpressionState {
  return { identity, tagsByUserId: {}, status: "idle", error: null, receipt: null };
}

function emptyNextIntent(identity: string): NextIntentState {
  return { identity, type: null, status: "idle", error: null, receipt: null };
}

function emptyParticipants(identity: string): ParticipantState {
  return { identity, members: [], status: "idle", error: null };
}

export default function FeedbackPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "han-river-walk";
  const meetupHref = `/meetups/${encodeURIComponent(meetupId)}`;
  const safetyHref = `${meetupHref}/safety-cancel`;
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  // Session-scoped identity: the same subject logging in again after logout is
  // a distinct UI session, so stale participants, answers, and receipts from
  // the old session cannot render in the new one.
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  const pageIdentity = `${sessionEpoch}:${subject ?? "anonymous"}:${meetupId}`;
  const identityRef = useRef(pageIdentity);
  const feedbackRequestRef = useRef(0);
  const impressionsRequestRef = useRef(0);
  const nextIntentRequestRef = useRef(0);
  const participantRequestRef = useRef(0);
  const feedbackReceiptRef = useRef<HTMLParagraphElement>(null);
  const impressionsReceiptRef = useRef<HTMLParagraphElement>(null);
  const nextIntentReceiptRef = useRef<HTMLParagraphElement>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(() => emptyFeedback(pageIdentity));
  const [impressions, setImpressions] = useState<ImpressionState>(() => emptyImpressions(pageIdentity));
  const [nextIntent, setNextIntent] = useState<NextIntentState>(() => emptyNextIntent(pageIdentity));
  const [participants, setParticipants] = useState<ParticipantState>(() => emptyParticipants(pageIdentity));
  const online = useOnlineStatus();

  identityRef.current = pageIdentity;
  const currentFeedback = feedback.identity === pageIdentity ? feedback : emptyFeedback(pageIdentity);
  const currentImpressions = impressions.identity === pageIdentity ? impressions : emptyImpressions(pageIdentity);
  const currentNextIntent = nextIntent.identity === pageIdentity ? nextIntent : emptyNextIntent(pageIdentity);
  const currentParticipants = participants.identity === pageIdentity ? participants : emptyParticipants(pageIdentity);
  const visibleParticipants = subject === null
    ? []
    : currentParticipants.members.filter((member) => member.state === "CHECKED_IN" && member.userId !== subject);
  const impressionTargets = Object.entries(currentImpressions.tagsByUserId)
    .filter(([, tags]) => tags.length > 0)
    .map(([recipientUserId, tags]) => ({ recipientUserId, tags }));
  const isFeedbackPending = currentFeedback.status === "pending";
  const isImpressionsPending = currentImpressions.status === "pending";
  const isNextIntentPending = currentNextIntent.status === "pending";
  const isImpressionsSaved = currentImpressions.status === "success";
  const isNextIntentSaved = currentNextIntent.status === "success";

  useEffect(() => {
    feedbackRequestRef.current += 1;
    impressionsRequestRef.current += 1;
    nextIntentRequestRef.current += 1;
    const participantRequest = ++participantRequestRef.current;
    setFeedback(emptyFeedback(pageIdentity));
    setImpressions(emptyImpressions(pageIdentity));
    setNextIntent(emptyNextIntent(pageIdentity));
    setParticipants(subject === null ? emptyParticipants(pageIdentity) : {
      ...emptyParticipants(pageIdentity),
      status: "loading",
    });

    if (!auth || subject === null) return;
    void auth.listParticipants(meetupId, { limit: 20 })
      .then((page) => {
        if (participantRequest !== participantRequestRef.current || identityRef.current !== pageIdentity) return;
        setParticipants({
          identity: pageIdentity,
          members: page.items,
          nextCursor: page.nextCursor,
          status: "ready",
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (participantRequest !== participantRequestRef.current || identityRef.current !== pageIdentity || error instanceof SessionExpiredError) return;
        setParticipants({
          ...emptyParticipants(pageIdentity),
          status: "error",
          error: problemMessage(error, "참가자를 불러오지 못했어요."),
        });
      });
  }, [auth, meetupId, pageIdentity, subject]);

  useEffect(() => {
    if (currentFeedback.status === "success") feedbackReceiptRef.current?.focus();
  }, [currentFeedback.status]);

  useEffect(() => {
    if (currentImpressions.status === "success") impressionsReceiptRef.current?.focus();
  }, [currentImpressions.status]);

  useEffect(() => {
    if (currentNextIntent.status === "success") nextIntentReceiptRef.current?.focus();
  }, [currentNextIntent.status]);

  function updateScore(field: FeedbackField, score: FeedbackScore) {
    setFeedback((previous) => previous.identity !== pageIdentity
      ? previous
      : { ...previous, answers: { ...previous.answers, [field]: score }, status: "idle", error: null, receipt: null });
  }

  function updatePrivateComment(privateComment: string) {
    setFeedback((previous) => previous.identity !== pageIdentity
      ? previous
      : { ...previous, privateComment, status: "idle", error: null, receipt: null });
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentFeedback.status === "pending" || !auth || subject === null) {
      if (!auth || subject === null) {
        setFeedback((previous) => previous.identity !== pageIdentity
          ? previous
          : { ...previous, status: "error", error: "로그인 후 비공개 피드백을 제출할 수 있어요." });
      }
      return;
    }
    if (!online) {
      setFeedback((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "error", error: "인터넷 연결이 끊겨 피드백을 제출할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요." });
      return;
    }

    const { expectationMatch, feltSafe, facilitationComfort, wouldUseAgain } = currentFeedback.answers;
    if (
      expectationMatch === undefined ||
      feltSafe === undefined ||
      facilitationComfort === undefined ||
      wouldUseAgain === undefined
    ) {
      setFeedback((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "error", error: "네 개의 점수를 모두 선택해 주세요." });
      return;
    }
    if (currentFeedback.privateComment.length > 2000) {
      setFeedback((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "error", error: "비공개 의견은 2,000자 이하로 작성해 주세요." });
      return;
    }

    const input: FeedbackRequest = {
      expectationMatch,
      feltSafe,
      facilitationComfort,
      wouldUseAgain,
      privateComment: currentFeedback.privateComment.trim(),
    };
    const request = ++feedbackRequestRef.current;
    setFeedback((previous) => previous.identity !== pageIdentity
      ? previous
      : { ...previous, status: "pending", error: null, receipt: null });
    try {
      const receipt = await auth.createFeedback(meetupId, input);
      if (request !== feedbackRequestRef.current || identityRef.current !== pageIdentity) return;
      setFeedback((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "success", error: null, receipt });
    } catch (error) {
      if (request !== feedbackRequestRef.current || identityRef.current !== pageIdentity || error instanceof SessionExpiredError) return;
      setFeedback((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: error instanceof ApiProblemError && error.status === 409 ? "conflict" : "error", error: problemMessage(error, "피드백을 제출하지 못했어요.") });
    }
  }

  function toggleImpressionTag(userId: string, tag: ImpressionTag) {
    setImpressions((previous) => {
      if (previous.identity !== pageIdentity || previous.status === "pending" || previous.status === "success") return previous;
      const currentTags = previous.tagsByUserId[userId] ?? [];
      const isSelected = currentTags.includes(tag);
      const targetCount = Object.values(previous.tagsByUserId).filter((tags) => tags.length > 0).length;
      if (!isSelected && currentTags.length === 0 && targetCount >= 7) {
        return { ...previous, status: "error", error: "인상은 최대 7명에게 남길 수 있어요.", receipt: null };
      }
      if (!isSelected && currentTags.length >= 4) {
        return { ...previous, status: "error", error: "한 사람에게는 태그를 최대 4개까지 고를 수 있어요.", receipt: null };
      }
      const tags = isSelected ? currentTags.filter((value) => value !== tag) : [...currentTags, tag];
      const tagsByUserId = { ...previous.tagsByUserId, [userId]: tags };
      if (tags.length === 0) delete tagsByUserId[userId];
      return { ...previous, tagsByUserId, status: "idle", error: null, receipt: null };
    });
  }

  async function submitImpressions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentImpressions.status === "pending" || currentImpressions.status === "success") return;
    if (!auth || subject === null) {
      setImpressions((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "error", error: "로그인 후 참가자별 인상을 남길 수 있어요." });
      return;

    if (!online) {
      setImpressions((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "error", error: "인터넷 연결이 끊겨 인상을 저장할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요." });
      return;
    }    }
    if (impressionTargets.length === 0 || impressionTargets.length > 7 || impressionTargets.some((item) => item.tags.length < 1 || item.tags.length > 4)) {
      setImpressions((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "error", error: "1명 이상 7명 이하를 고르고, 각 사람에게 태그를 1개 이상 4개 이하로 남겨 주세요." });
      return;
    }

    const input: ImpressionRequest = { impressions: impressionTargets };
    const request = ++impressionsRequestRef.current;
    setImpressions((previous) => previous.identity !== pageIdentity
      ? previous
      : { ...previous, status: "pending", error: null, receipt: null });
    try {
      const receipt = await auth.createImpressions(meetupId, input);
      if (request !== impressionsRequestRef.current || identityRef.current !== pageIdentity) return;
      setImpressions((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "success", error: null, receipt });
    } catch (error) {
      if (request !== impressionsRequestRef.current || identityRef.current !== pageIdentity || error instanceof SessionExpiredError) return;
      const conflict = error instanceof ApiProblemError && error.status === 409;
      setImpressions((previous) => previous.identity !== pageIdentity
        ? previous
        : {
          ...previous,
          status: conflict ? "conflict" : "error",
          error: problemMessage(error, conflict ? "이미 처리 중이거나 저장된 인상이에요. 다시 시도할 수 있어요." : "인상을 저장하지 못했어요. 다시 시도해 주세요."),
        });
    }
  }

  function chooseNextIntent(type: NextIntentType) {
    setNextIntent((previous) => previous.identity !== pageIdentity || previous.status === "pending" || previous.status === "success"
      ? previous
      : { ...previous, type, status: "idle", error: null, receipt: null });
  }

  async function submitNextIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentNextIntent.status === "pending" || currentNextIntent.status === "success") return;
    if (!auth || subject === null) {
      setNextIntent((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "error", error: "로그인 후 다음 행동을 선택할 수 있어요." });
      return;

    if (!online) {
      setNextIntent((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "error", error: "인터넷 연결이 끊겨 다음 행동을 저장할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요." });
      return;
    }    }
    if (currentNextIntent.type === null) {
      setNextIntent((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "error", error: "다음에 하고 싶은 활동을 하나 선택해 주세요." });
      return;
    }

    const request = ++nextIntentRequestRef.current;
    setNextIntent((previous) => previous.identity !== pageIdentity
      ? previous
      : { ...previous, status: "pending", error: null, receipt: null });
    try {
      const receipt = await auth.createNextIntent(meetupId, { type: currentNextIntent.type });
      if (request !== nextIntentRequestRef.current || identityRef.current !== pageIdentity) return;
      setNextIntent((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: "success", error: null, receipt });
    } catch (error) {
      if (request !== nextIntentRequestRef.current || identityRef.current !== pageIdentity || error instanceof SessionExpiredError) return;
      const conflict = error instanceof ApiProblemError && error.status === 409;
      setNextIntent((previous) => previous.identity !== pageIdentity
        ? previous
        : { ...previous, status: conflict ? "conflict" : "error", error: problemMessage(error, "다음 행동을 저장하지 못했어요. 다시 시도해 주세요.") });
    }
  }

  function retryParticipants() {
    if (!auth || subject === null) return;
    const request = ++participantRequestRef.current;
    setParticipants((previous) => previous.identity !== pageIdentity
      ? previous
      : { ...previous, status: "loading", error: null });
    void auth.listParticipants(meetupId, { limit: 20 })
      .then((page) => {
        if (request !== participantRequestRef.current || identityRef.current !== pageIdentity) return;
        setParticipants({ identity: pageIdentity, members: page.items, nextCursor: page.nextCursor, status: "ready", error: null });
      })
      .catch((error: unknown) => {
        if (request !== participantRequestRef.current || identityRef.current !== pageIdentity || error instanceof SessionExpiredError) return;
        setParticipants({ ...emptyParticipants(pageIdentity), status: "error", error: problemMessage(error, "참가자를 불러오지 못했어요.") });
      });
  }

  function loadMoreParticipants() {
    if (!auth || !currentParticipants.nextCursor || currentParticipants.status === "appending") return;
    const request = participantRequestRef.current;
    const cursor = currentParticipants.nextCursor;
    setParticipants((previous) => previous.identity !== pageIdentity
      ? previous
      : { ...previous, status: "appending", error: null });
    void auth.listParticipants(meetupId, { cursor, limit: 20 })
      .then((page) => {
        if (request !== participantRequestRef.current || identityRef.current !== pageIdentity) return;
        setParticipants((previous) => previous.identity !== pageIdentity
          ? previous
          : {
            identity: pageIdentity,
            members: [...previous.members, ...page.items.filter((item) => !previous.members.some((member) => member.userId === item.userId))],
            nextCursor: page.nextCursor,
            status: "ready",
            error: null,
          });
      })
      .catch((error: unknown) => {
        if (request !== participantRequestRef.current || identityRef.current !== pageIdentity || error instanceof SessionExpiredError) return;
        setParticipants((previous) => previous.identity !== pageIdentity
          ? previous
          : { ...previous, status: "ready", error: problemMessage(error, "참가자를 더 불러오지 못했어요.") });
      });
  }

  return (
    <ScreenShell bottomSpacing>
      <TopNavigation
        href={meetupHref}
        title={<span className="font-display text-[length:var(--type-page-title)] font-normal leading-6">만남 후 기록</span>}
      />
      <OfflineNotice className="mx-5 mt-5" />

      <div className="flex flex-1 flex-col px-5 pb-8">
        <section className="mt-4" aria-labelledby="feedback-heading">
          <p className="m-0 whitespace-pre-line text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            {"나와 운영팀만 확인해요.\n검색·순위·참가 자격에는 쓰지 않아요."}
          </p>
          <h1 id="feedback-heading" className="mt-2 m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 tracking-[-0.02em] text-[var(--fg-neutral)]">
            오늘 만남은 어땠나요?
          </h1>
        </section>

        {subject === null ? <p className="mt-4" role="alert">로그인 후 비공개 피드백을 제출할 수 있어요.</p> : null}

        <form id="feedback-form" className="mt-1" onSubmit={submitFeedback}>
          {questions.map((question) => (
            <fieldset key={question.id} className="m-0 border-0 p-0 [&+fieldset]:mt-3" disabled={isFeedbackPending || currentFeedback.status === "success"}>
              <legend className="text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">{question.label}</legend>
              <div className="mt-2 grid grid-cols-5 gap-1">
                {scoreOptions.map((score) => {
                  const inputId = `feedback-${question.id}-${score}`;
                  return (
                    <label key={score} className="flex min-h-[48px] min-w-0 cursor-pointer items-center justify-center gap-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)] [&:has(input:checked)]:font-semibold [&:has(input:checked)]:text-[var(--fg-neutral)]" htmlFor={inputId}>
                      <input id={inputId} className="size-5 shrink-0 accent-[var(--fg-neutral)]" type="radio" name={`feedback-${question.id}`} value={score} checked={currentFeedback.answers[question.id] === score} onChange={() => updateScore(question.id, score)} />
                      <span>{score}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <label className="mt-4 block text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]" htmlFor="feedback-private-comment">비공개 의견 (선택)</label>
          <textarea id="feedback-private-comment" className="mt-2 min-h-[96px] w-full resize-y rounded-[10px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] p-3 text-[length:var(--type-body)] leading-[22px] outline-none focus-visible:border-[var(--fg-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]" value={currentFeedback.privateComment} maxLength={2000} disabled={isFeedbackPending || currentFeedback.status === "success"} onChange={(event) => updatePrivateComment(event.target.value)} />
          <p className="m-0 mt-1 text-right text-[12px] leading-4 text-[var(--fg-muted)]">{currentFeedback.privateComment.length}/2000</p>
        </form>

        {isFeedbackPending ? <p className="mt-4" role="status">피드백을 제출하는 중이에요.</p> : null}
        {currentFeedback.status === "error" || currentFeedback.status === "conflict" ? (
          <div className="mt-4" role="alert">
            <p>{currentFeedback.error}</p>
            {subject !== null ? <button type="submit" form="feedback-form">다시 시도</button> : null}
          </div>
        ) : null}
        {currentFeedback.status === "success" && currentFeedback.receipt ? (
          <p ref={feedbackReceiptRef} className="mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-positive)]" role="status" aria-live="polite" tabIndex={-1}>비공개 피드백을 제출했어요. 운영팀만 확인할 수 있어요.</p>
        ) : null}

        <section className="mt-6 border-t border-[var(--stroke-neutral)] pt-5" aria-labelledby="impressions-heading">
          <h2 id="impressions-heading" className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">참가자별 긍정 인상</h2>
          <p className="m-0 mt-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">체크인한 참가자에게만 남길 수 있어요. 공개 인기 순위나 참여 자격에는 쓰지 않아요.</p>
          <form id="impressions-form" className="mt-3" onSubmit={submitImpressions}>
            {currentParticipants.status === "loading" ? <p role="status">참가자를 불러오는 중이에요.</p> : null}
            {currentParticipants.status === "error" ? <div role="alert"><p>{currentParticipants.error}</p><button type="button" onClick={retryParticipants}>다시 시도</button></div> : null}
            {currentParticipants.status === "ready" || currentParticipants.status === "appending" ? (
              <>
                {visibleParticipants.length === 0 ? <p role="status">인상을 남길 체크인 참가자가 없어요.</p> : null}
                <div className="mt-3 space-y-4">
                  {visibleParticipants.map((participant) => {
                    const tags = currentImpressions.tagsByUserId[participant.userId] ?? [];
                    const targetLimitReached = impressionTargets.length >= 7 && tags.length === 0;
                    return (
                      <fieldset key={participant.userId} className="m-0 border-0 border-t border-[var(--stroke-neutral)] pt-3 p-0" disabled={isImpressionsPending || isImpressionsSaved}>
                        <legend className="text-[15px] font-semibold leading-6 text-[var(--fg-neutral)]">{participant.displayName}</legend>
                        <div className="mt-2 grid gap-2">
                          {impressionTags.map((tag) => {
                            const checked = tags.includes(tag.value);
                            return (
                              <label key={tag.value} className="flex min-h-[48px] items-center gap-3 px-1 text-[15px] leading-6 text-[var(--fg-neutral)]">
                                <input className="size-5 accent-[var(--fg-neutral)]" type="checkbox" checked={checked} disabled={!checked && targetLimitReached} onChange={() => toggleImpressionTag(participant.userId, tag.value)} />
                                <span className="flex-1">{tag.label}</span>
                                {checked ? <Check size={20} aria-hidden="true" /> : null}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
                {currentParticipants.nextCursor ? <button className="mt-3 min-h-[44px]" type="button" disabled={currentParticipants.status === "appending"} onClick={loadMoreParticipants}>{currentParticipants.status === "appending" ? "더 불러오는 중…" : "참가자 더 보기"}</button> : null}
                {currentParticipants.status === "ready" && currentParticipants.error ? <div className="mt-3" role="alert"><p>{currentParticipants.error}</p><button type="button" onClick={loadMoreParticipants}>더 보기 재시도</button></div> : null}
              </>
            ) : null}
            <button className="mt-4 min-h-[48px] w-full border border-[var(--stroke-neutral)] px-4 text-[length:var(--type-action)] font-semibold leading-6 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" type="submit" disabled={subject === null || !online || isImpressionsPending || isImpressionsSaved || currentParticipants.status !== "ready" || impressionTargets.length === 0}>
              {isImpressionsPending ? "저장 중…" : isImpressionsSaved ? "인상 저장됨" : "인상 저장하기"}
            </button>
          </form>
          {isImpressionsPending ? <p className="mt-3" role="status">참가자별 인상을 저장하는 중이에요.</p> : null}
          {currentImpressions.status === "error" || currentImpressions.status === "conflict" ? <div className="mt-3" role="alert"><p>{currentImpressions.error}</p>{subject !== null && impressionTargets.length > 0 ? <button type="submit" form="impressions-form">다시 시도</button> : null}</div> : null}
          {isImpressionsSaved && currentImpressions.receipt ? <p ref={impressionsReceiptRef} className="mt-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-positive)]" role="status" aria-live="polite" tabIndex={-1}>참가자별 인상을 저장했어요.</p> : null}
        </section>

        <section className="mt-6 border-t border-[var(--stroke-neutral)] pt-5" aria-labelledby="next-intent-heading">
          <h2 id="next-intent-heading" className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">다음에는 어떻게 하고 싶나요?</h2>
          <form id="next-intent-form" className="mt-3" onSubmit={submitNextIntent}>
            <fieldset className="m-0 border-0 p-0" disabled={isNextIntentPending || isNextIntentSaved}>
              <legend className="sr-only">다음 행동 선택</legend>
              {nextIntentOptions.map((option) => (
                <label key={option.value} className="flex min-h-[48px] items-center gap-3 border-t border-[var(--stroke-neutral)] py-3 text-[15px] leading-6 text-[var(--fg-neutral)]">
                  <input className="size-5 accent-[var(--fg-neutral)]" type="radio" name="next-intent" value={option.value} checked={currentNextIntent.type === option.value} onChange={() => chooseNextIntent(option.value)} />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <button className="mt-4 min-h-[48px] w-full border border-[var(--stroke-neutral)] px-4 text-[length:var(--type-action)] font-semibold leading-6 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" type="submit" disabled={subject === null || !online || isNextIntentPending || isNextIntentSaved || currentNextIntent.type === null}>
              {isNextIntentPending ? "저장 중…" : isNextIntentSaved ? "다음 행동 저장됨" : "다음 행동 저장하기"}
            </button>
          </form>
          {isNextIntentPending ? <p className="mt-3" role="status">다음 행동을 저장하는 중이에요.</p> : null}
          {currentNextIntent.status === "error" || currentNextIntent.status === "conflict" ? <div className="mt-3" role="alert"><p>{currentNextIntent.error}</p>{subject !== null ? <button type="submit" form="next-intent-form">다시 시도</button> : null}</div> : null}
          {isNextIntentSaved && currentNextIntent.receipt ? <p ref={nextIntentReceiptRef} className="mt-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-positive)]" role="status" aria-live="polite" tabIndex={-1}>다음 행동을 저장했어요.</p> : null}
        </section>

        <Link className="mt-6 flex min-h-[56px] items-center justify-between border-y border-[var(--stroke-neutral)] py-3 text-[15px] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" href={safetyHref}>
          <span>피드백과 별도로 안전 문제 신고하기</span>
          <ChevronRight className="shrink-0" size={24} strokeWidth={1.8} aria-hidden="true" />
        </Link>
        <p className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">설문 답변이나 인상만으로 신고가 접수되지는 않아요.</p>
      </div>

      <BottomActionBar>
        <button className="flex min-h-[52px] w-full items-center justify-center bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-on-brand)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" type="submit" form="feedback-form" disabled={subject === null || !online || isFeedbackPending || currentFeedback.status === "success"}>
          {isFeedbackPending ? "제출 중…" : currentFeedback.status === "success" ? "피드백 제출됨" : "비공개로 제출하기"}
        </button>
        <div className="grid min-h-[44px] grid-cols-2 gap-2">
          <Link className="flex min-h-[44px] items-center justify-center px-2 text-[length:var(--type-action)] leading-6 text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" href="/my-meetups">나중에 답하기</Link>
          <Link className="flex min-h-[44px] items-center justify-center px-2 text-[length:var(--type-action)] leading-6 text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" href={meetupHref}>이번에는 건너뛰기</Link>
        </div>
      </BottomActionBar>
    </ScreenShell>
  );
}
