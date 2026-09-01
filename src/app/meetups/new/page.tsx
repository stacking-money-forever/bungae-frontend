"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { StatusBanner } from "@/components/status-banner";
import { TopNavigation } from "@/components/top-navigation";

interface CreateFormValues {
  activity: string;
  title: string;
  purpose: string;
  start: string;
  end: string;
  location: string;
  minimum: string;
  capacity: string;
  costAlcohol: string;
  deadline: string;
}

const initialValues: CreateFormValues = {
  activity: "산책",
  title: "퇴근 후 한강 산책",
  purpose: "20분 산책 후 카페에서 이야기 나눠요",
  start: "오늘 18:30",
  end: "20:00",
  location: "망원한강공원 · 공개 장소",
  minimum: "최소 3명",
  capacity: "정원 6명",
  costAlcohol: "무료 · 음주 없음",
  deadline: "오늘 17:30",
};

interface ReviewInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ReviewInput({ id, label, value, onChange }: ReviewInputProps) {
  const valueTypography =
    id === "time" || id === "deadline"
      ? "font-display text-[length:var(--type-time)] font-normal leading-6"
      : "text-[length:var(--type-title)] font-semibold leading-5";

  return (
    <div className="grid min-h-[52px] grid-cols-[72px_minmax(0,1fr)] items-center gap-3 border-b border-[var(--stroke-neutral)]">
      <label className="text-[length:var(--type-body)] leading-5 text-[var(--fg-muted)]" htmlFor={id}>
        {label}
      </label>
      <input
        className={`min-h-[44px] min-w-0 w-full bg-transparent text-right ${valueTypography} text-[var(--fg-neutral)] outline-none focus-visible:rounded-[var(--dimension-x1)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]`}
        id={id}
        name={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${label} 입력`}
      />
    </div>
  );
}

export default function NewMeetupPage() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("posted") === "1") {
      setPosted(true);
    }
  }, []);

  const updateValue = (id: keyof CreateFormValues, value: string) => {
    setValues((current) => ({ ...current, [id]: value }));
    if (id === "title" && value.trim().length > 0) {
      setError(null);
    }
  };

  const postMeetup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.title.trim()) {
      setError("모임 제목을 입력해 주세요.");
      return;
    }
    if (isPosting) {
      return;
    }

    setIsPosting(true);
    setPosted(true);
    router.push("/meetups/new?posted=1");
  };

  if (posted) {
    return (
      <ScreenShell bottomSpacing aria-label="모임 게시 완료">
        <TopNavigation href="/meetups/new" title="게시 완료" />
        <ResultSection
          className="px-[var(--dimension-x5)] pb-8 pt-12"
          tone="positive"
          heading="모임을 게시했어요"
          description="첫 참가자로 등록됐어요. 이제 다른 참가자를 기다려요."
        >
          <StatusBanner
            tone="positive"
            label="오늘 18:30 · 망원한강공원"
            description="생성 후 24시간 안에 시작하는 공개 모임이에요."
          />
        </ResultSection>
        <BottomActionBar>
          <Link
            className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            href="/my-meetups"
          >
            내 모임에서 확인하기
          </Link>
        </BottomActionBar>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell bottomSpacing aria-label="모임 만들기 검토">
      <TopNavigation href="/" title="검토" />
      <form
        className="px-[var(--dimension-x5)] pb-8 pt-6"
        id="create-meetup-form"
        onSubmit={postMeetup}
      >
        <h2 className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
          이대로 모임을 만들까요?
        </h2>

        {error ? (
          <StatusBanner className="mt-4 rounded-[var(--dimension-x2)]" tone="critical" label={error} />
        ) : null}

        <div className="mt-5 border-t border-[var(--stroke-neutral)]">
          <div className="grid min-h-[52px] grid-cols-[72px_minmax(0,1fr)] items-center gap-3 border-b border-[var(--stroke-neutral)]">
            <label className="text-[length:var(--type-body)] leading-5 text-[var(--fg-muted)]" htmlFor="activity">
              활동
            </label>
            <div className="flex min-w-0 items-center gap-2">
              <select
                className="min-h-[44px] min-w-0 shrink-0 appearance-none bg-transparent text-[length:var(--type-title)] font-semibold leading-5 text-[var(--fg-neutral)] outline-none focus-visible:rounded-[var(--dimension-x1)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]"
                id="activity"
                value={values.activity}
                onChange={(event) => updateValue("activity", event.target.value)}
                aria-label="활동 선택"
              >
                <option>산책</option>
                <option>식사</option>
                <option>보드게임</option>
                <option>카페 대화</option>
              </select>
              <span aria-hidden="true">·</span>
              <input
                className="min-h-[44px] min-w-0 flex-1 bg-transparent text-right text-[length:var(--type-title)] font-semibold leading-5 text-[var(--fg-neutral)] outline-none focus-visible:rounded-[var(--dimension-x1)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]"
                id="title"
                name="title"
                type="text"
                value={values.title}
                onChange={(event) => updateValue("title", event.target.value)}
                aria-label="모임 제목 입력"
              />
            </div>
          </div>
          <ReviewInput
            id="purpose"
            label="목적"
            value={values.purpose}
            onChange={(value) => updateValue("purpose", value)}
          />
          <ReviewInput
            id="time"
            label="시간"
            value={`${values.start}–${values.end}`}
            onChange={(value) => {
              const [start, end] = value.split("–");
              updateValue("start", start?.trim() ?? value);
              updateValue("end", end?.trim() ?? "");
            }}
          />
          <ReviewInput
            id="location"
            label="장소"
            value={values.location}
            onChange={(value) => updateValue("location", value)}
          />
          <div className="grid min-h-[52px] grid-cols-[72px_minmax(0,1fr)] items-center gap-3 border-b border-[var(--stroke-neutral)]">
            <span className="text-[length:var(--type-body)] leading-5 text-[var(--fg-muted)]">인원</span>
            <div className="flex min-w-0 items-center gap-2">
              <input
                className="min-h-[44px] min-w-0 flex-1 bg-transparent text-right text-[length:var(--type-title)] font-semibold leading-5 text-[var(--fg-neutral)] outline-none focus-visible:rounded-[var(--dimension-x1)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]"
                aria-label="최소 성사 인원"
                value={values.minimum}
                onChange={(event) => updateValue("minimum", event.target.value)}
              />
              <span aria-hidden="true">·</span>
              <input
                className="min-h-[44px] min-w-0 flex-1 bg-transparent text-right text-[length:var(--type-title)] font-semibold leading-5 text-[var(--fg-neutral)] outline-none focus-visible:rounded-[var(--dimension-x1)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]"
                aria-label="정원"
                value={values.capacity}
                onChange={(event) => updateValue("capacity", event.target.value)}
              />
            </div>
          </div>
          <ReviewInput
            id="costAlcohol"
            label="비용·음주"
            value={values.costAlcohol}
            onChange={(value) => updateValue("costAlcohol", value)}
          />
          <ReviewInput
            id="deadline"
            label="확정 마감"
            value={values.deadline}
            onChange={(value) => updateValue("deadline", value)}
          />
        </div>

        <StatusBanner
          className="mt-3 rounded-[12px]"
          tone="positive"
          label="만들면 바로 첫 참가자 1명으로 시작해요."
        />

        <ul className="m-0 mt-4 list-none space-y-2 p-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          <li>· 생성 시점부터 24시간 안에 시작해요</li>
          <li>· 비공개 장소는 등록할 수 없어요</li>
          <li>· 미달 시 제안자가 진행 또는 취소를 결정해요</li>
        </ul>
      </form>

      <BottomActionBar>
        <button
          className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          form="create-meetup-form"
          disabled={isPosting}
        >
          {isPosting ? "게시 중…" : "모임 만들기"}
        </button>
      </BottomActionBar>
    </ScreenShell>
  );
}
