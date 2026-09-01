"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

type FeedbackOutcome = "submitted" | "later" | "skipped" | null;

const scaleOptions = ["전혀", "조금", "꽤", "매우"] as const;

const questions = [
  { id: "fit", label: "기대와 실제가 얼마나 비슷했나요?" },
  { id: "safe", label: "얼마나 안전하게 느꼈나요?" },
  { id: "comfortable", label: "진행이 얼마나 편안했나요?" },
] as const;

const impressionOptions = [
  { id: "punctual", label: "시간을 잘 지켰어요" },
  { id: "considerate", label: "배려했어요" },
] as const;

export default function FeedbackPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "han-river-walk";
  const meetupHref = `/meetups/${encodeURIComponent(meetupId)}`;
  const safetyHref = `${meetupHref}/safety-cancel`;
  const [answers, setAnswers] = useState<Record<string, string>>({
    fit: "꽤",
    safe: "꽤",
    comfortable: "꽤",
  });
  const [impressions, setImpressions] = useState<Record<string, boolean>>({ punctual: true });
  const [outcome, setOutcome] = useState<FeedbackOutcome>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOutcome("submitted");
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function toggleImpression(impressionId: string) {
    setImpressions((current) => ({ ...current, [impressionId]: !current[impressionId] }));
  }

  return (
    <ScreenShell bottomSpacing>
      <TopNavigation
        href={meetupHref}
        title={<span className="font-display text-[length:var(--type-page-title)] font-normal leading-6">비공개 피드백</span>}
      />

      <div className="flex flex-1 flex-col px-5 pb-8">
        <section className="mt-4" aria-labelledby="feedback-heading">
          <p className="m-0 whitespace-pre-line text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            {"나와 운영팀만 확인해요.\n검색·순위·참가 자격에는 쓰지 않아요."}
          </p>
          <h2
            id="feedback-heading"
            className="mt-2 m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 tracking-[-0.02em] text-[var(--fg-neutral)]"
          >
            오늘 만남은 어땠나요?
          </h2>
        </section>

        <form id="feedback-form" className="mt-1" onSubmit={handleSubmit}>
          {questions.map((question) => (
            <fieldset key={question.id} className="m-0 border-0 p-0 [&+fieldset]:mt-3">
              <legend className="text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">{question.label}</legend>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {scaleOptions.map((option) => {
                  const inputId = `feedback-${question.id}-${option}`;
                  return (
                    <label
                      key={option}
                      className="flex min-h-[48px] min-w-0 cursor-pointer items-center justify-center gap-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)] [&:has(input:checked)]:font-semibold [&:has(input:checked)]:text-[var(--fg-neutral)]"
                      htmlFor={inputId}
                    >
                      <input
                        id={inputId}
                        className="size-6 shrink-0 accent-[var(--fg-neutral)]"
                        type="radio"
                        name={`feedback-${question.id}`}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={(event) => updateAnswer(question.id, event.target.value)}
                      />
                      <span className="truncate">{option}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <fieldset className="mt-3 m-0 border-0 p-0">
            <legend className="text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">선택 사항 · 행동 중심 긍정 인상</legend>
            <div className="mt-2 divide-y divide-[var(--stroke-neutral)] border-y border-[var(--stroke-neutral)]">
              {impressionOptions.map((impression) => {
                const inputId = `impression-${impression.id}`;
                return (
                  <label
                    key={impression.id}
                    className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 py-1 text-[15px] leading-6 text-[var(--fg-neutral)]"
                    htmlFor={inputId}
                  >
                    <span>{impression.label}</span>
                    <input
                      id={inputId}
                      className="size-7 shrink-0 accent-[var(--fg-neutral)]"
                      type="checkbox"
                      checked={Boolean(impressions[impression.id])}
                      onChange={() => toggleImpression(impression.id)}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Link
            className="mt-3 flex min-h-[56px] items-center justify-between border-y border-[var(--stroke-neutral)] py-3 text-[15px] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            href={safetyHref}
          >
            <span>피드백과 별도로 안전 문제 신고하기</span>
            <ChevronRight className="shrink-0" size={24} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <p className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">설문 답변만으로 신고가 접수되지는 않아요.</p>
        </form>

        {outcome ? (
          <p className="mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-positive)]" role="status" aria-live="polite">
            {outcome === "submitted"
              ? "비공개 피드백을 제출했어요. 운영팀만 확인할 수 있어요."
              : outcome === "later"
                ? "피드백을 저장했어요. 나중에 다시 답할 수 있어요."
                : "이번 피드백은 건너뛰었어요. 참여에 불이익은 없어요."}
          </p>
        ) : null}
      </div>

      <BottomActionBar>
        <button
          className="flex min-h-[52px] w-full items-center justify-center bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          type="submit"
          form="feedback-form"
        >
          {outcome === "submitted" ? "제출 완료" : "비공개로 제출하기"}
        </button>
        <div className="grid min-h-[44px] grid-cols-2 gap-2">
          <button
            className="min-h-[44px] px-2 text-[length:var(--type-action)] leading-6 text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
            onClick={() => setOutcome("later")}
          >
            나중에 하기
          </button>
          <button
            className="min-h-[44px] px-2 text-[length:var(--type-action)] leading-6 text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
            onClick={() => setOutcome("skipped")}
          >
            이번에는 건너뛰기
          </button>
        </div>
      </BottomActionBar>
    </ScreenShell>
  );
}
