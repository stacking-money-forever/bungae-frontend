"use client";

import { CalendarDays, ChevronRight, CircleCheck, MapPin, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

const appealReasons = [
  { value: "attended", label: "실제로 참석했어요" },
  { value: "safety", label: "안전 사유로 참석하지 못했어요" },
  { value: "record", label: "체크인 기록을 다시 확인해 주세요" },
] as const;

export default function AttendancePage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "han-river-walk";
  const meetupHref = `/meetups/${encodeURIComponent(meetupId)}`;
  const safetyHref = `${meetupHref}/safety-cancel`;
  const [appealOpen, setAppealOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleAppealSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) return;
    setSubmitted(true);
  }

  return (
    <ScreenShell bottomSpacing>
      <TopNavigation
        href={meetupHref}
        title="출석 기록"
      />

      <div className="flex flex-1 flex-col px-5 pb-8">
        <section className="mt-5 rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-4" aria-labelledby="attendance-review-title">
          <p className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">출석 기록 검토</p>
          <h2
            id="attendance-review-title"
            className="mt-2 m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 tracking-[-0.02em] text-[var(--fg-neutral)]"
          >
            체크인 기록을 찾지 못했어요
          </h2>
          <p className="mt-2 m-0 whitespace-pre-line text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            {"시스템 기록 기준이에요.\n실제 참석했거나 안전 사유가 있었다면\n이의를 제기할 수 있어요."}
          </p>
        </section>

        <section className="mt-5" aria-label="출석 근거">
          <div className="flex min-h-[64px] items-center gap-3 border-b border-[var(--stroke-neutral)]">
            <CalendarDays className="shrink-0 text-[var(--fg-neutral)]" size={26} strokeWidth={1.8} aria-hidden="true" />
            <div className="min-w-0 flex-1 py-2">
              <p className="m-0 text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">모임</p>
              <p className="m-0 truncate text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">8월 28일 · 퇴근 후 한강 산책</p>
            </div>
            <ChevronRight className="shrink-0 text-[var(--fg-muted)]" size={24} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="flex min-h-[64px] items-center gap-3 border-b border-[var(--stroke-neutral)]">
            <MapPin className="shrink-0 text-[var(--fg-neutral)]" size={26} strokeWidth={1.8} aria-hidden="true" />
            <div className="min-w-0 flex-1 py-2">
              <p className="m-0 text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">체크인 기록</p>
              <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">모임 코드·장소 기반 기록 없음</p>
            </div>
            <ChevronRight className="shrink-0 text-[var(--fg-muted)]" size={24} strokeWidth={1.8} aria-hidden="true" />
          </div>
        </section>

        <aside className="mt-6 rounded-[12px] bg-[var(--bg-positive-weak)] px-4 py-4" aria-label="안전 사유 안내">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-[var(--fg-positive)]" size={24} strokeWidth={1.8} aria-hidden="true" />
            <div>
              <p className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">안전 사유에는 자동 불이익이 없어요</p>
              <p className="m-0 mt-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
                상황을 알려주면 출석 신뢰 반영 전에 검토해요. 신고자와 상세 사유는 공개하지 않아요.
              </p>
            </div>
          </div>
        </aside>

        <a
          className="mt-4 flex min-h-[56px] items-center justify-between border-y border-[var(--stroke-neutral)] py-3 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          href={safetyHref}
        >
          <span>안전 문제도 함께 신고하기</span>
          <ChevronRight className="shrink-0" size={24} strokeWidth={1.8} aria-hidden="true" />
        </a>

        {appealOpen && !submitted ? (
          <form
            id="appeal-form"
            className="mt-6 border-t border-[var(--stroke-neutral)] pt-5"
            onSubmit={handleAppealSubmit}
            aria-labelledby="appeal-form-title"
          >
            <h2 id="appeal-form-title" className="m-0 font-display text-[length:var(--type-section)] font-normal leading-6">
              출석 기록 이의 제기
            </h2>
            <fieldset className="mt-4 m-0 border-0 p-0">
              <legend className="text-[length:var(--type-section)] font-semibold leading-6">어떤 내용으로 검토를 요청하나요?</legend>
              <div className="mt-2 divide-y divide-[var(--stroke-neutral)] border-y border-[var(--stroke-neutral)]">
                {appealReasons.map((option) => (
                  <label key={option.value} className="flex min-h-[52px] cursor-pointer items-center gap-3 py-2 text-[length:var(--type-body)] leading-[22px]">
                    <input
                      className="size-5 shrink-0 accent-[var(--fg-neutral)]"
                      type="radio"
                      name="appeal-reason"
                      value={option.value}
                      checked={reason === option.value}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="mt-4 block text-[length:var(--type-body)] font-semibold leading-[22px]" htmlFor="appeal-detail">
              자세한 내용 <span className="font-normal text-[var(--fg-muted)]">(선택)</span>
            </label>
            <textarea
              id="appeal-detail"
              className="mt-2 min-h-[112px] w-full resize-y border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] p-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)] outline-none focus-visible:border-[var(--fg-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="참석 상황이나 안전 사유를 적어 주세요."
            />
          </form>
        ) : null}

        {submitted ? (
          <ResultSection
            className="mt-4 px-0 py-5"
            tone="positive"
            heading="이의 제기를 접수했어요"
            description="상황을 확인한 뒤 출석 신뢰 반영 전에 결과를 알려드릴게요."
          >
            <div className="flex items-center justify-center gap-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              <CircleCheck size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>접수와 검토 결과는 알림으로 안내해요.</span>
            </div>
          </ResultSection>
        ) : null}
      </div>

      <BottomActionBar>
        {submitted ? (
          <button
            className="flex min-h-[52px] w-full items-center justify-center bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
            onClick={() => setSubmitted(false)}
          >
            확인했어요
          </button>
        ) : appealOpen ? (
          <button
            className="flex min-h-[52px] w-full items-center justify-center bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-on-brand)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="submit"
            form="appeal-form"
            disabled={!reason}
          >
            이의 제기 제출하기
          </button>
        ) : (
          <button
            className="flex min-h-[52px] w-full items-center justify-center bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
            onClick={() => setAppealOpen(true)}
          >
            이의 제기하기
          </button>
        )}
      </BottomActionBar>
    </ScreenShell>
  );
}
