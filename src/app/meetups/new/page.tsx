"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { setNavigationIntent } from "@/components/navigation-intent";
import { PlacePicker } from "@/components/place-picker";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { StatusBanner } from "@/components/status-banner";
import { TimeWheelPicker } from "@/components/time-wheel-picker";
import { TopNavigation } from "@/components/top-navigation";
import {
  createTimeOptions,
  createInitialValues,
  getTimeLabel,
  validateMeetupForm,
  type CreateFormErrors,
  type CreateFormValues,
} from "@/lib/meetup-form";

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
}

function TextField({ id, label, value, onChange, placeholder, error, multiline = false }: TextFieldProps) {
  const sharedClassName =
    "mt-1 min-h-[28px] w-full resize-none bg-transparent text-[14px] font-semibold leading-5 text-[var(--fg-neutral)] outline-none placeholder:font-normal placeholder:text-[var(--fg-muted)]";

  return (
    <label
      className={`block rounded-[12px] border bg-[var(--bg-layer-floating)] px-4 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-[var(--fg-neutral)] focus-within:ring-offset-2 ${
        error ? "border-[var(--fg-critical)]" : "border-[var(--stroke-neutral)] focus-within:border-[var(--fg-neutral)]"
      }`}
      htmlFor={id}
    >
      <span className="block text-[12px] leading-4 text-[var(--fg-muted)]">{label}</span>
      {multiline ? (
        <textarea
          className={`${sharedClassName} min-h-[52px]`}
          id={id}
          name={id}
          rows={2}
          value={value}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={sharedClassName}
          id={id}
          name={id}
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error ? (
        <span id={`${id}-error`} className="mt-1 block text-[12px] font-normal leading-4 text-[var(--fg-critical)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

interface NumberFieldProps {
  id: "minimum" | "capacity";
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function NumberField({ id, label, value, onChange, error }: NumberFieldProps) {
  return (
    <label
      className={`block rounded-[12px] border bg-[var(--bg-layer-floating)] px-4 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-[var(--fg-neutral)] focus-within:ring-offset-2 ${
        error ? "border-[var(--fg-critical)]" : "border-[var(--stroke-neutral)] focus-within:border-[var(--fg-neutral)]"
      }`}
      htmlFor={id}
    >
      <span className="block text-[12px] leading-4 text-[var(--fg-muted)]">{label}</span>
      <span className="mt-1 flex items-center gap-1">
        <input
          className="min-h-[28px] min-w-0 flex-1 bg-transparent text-[18px] font-bold leading-6 text-[var(--fg-neutral)] outline-none"
          id={id}
          name={id}
          type="text"
          aria-label={label}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ""))}
        />
        <span className="text-[13px] text-[var(--fg-muted)]">명</span>
      </span>
      {error ? (
        <span id={`${id}-error`} className="mt-1 block text-[12px] font-normal leading-4 text-[var(--fg-critical)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function NewMeetupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const posted = searchParams?.get("posted") === "1";
  const [timeOptions] = useState(() => createTimeOptions());
  const [values, setValues] = useState(() => createInitialValues(timeOptions));
  const [errors, setErrors] = useState<CreateFormErrors>({});
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (posted) {
      setIsPosting(false);
    }
  }, [posted]);

  const clearErrors = (...ids: Array<keyof CreateFormErrors>) => {
    setErrors((current) => {
      if (!ids.some((id) => current[id])) {
        return current;
      }
      const next = { ...current };
      ids.forEach((id) => delete next[id]);
      return next;
    });
  };

  const updateValue = <Key extends keyof CreateFormValues>(id: Key, value: CreateFormValues[Key]) => {
    setValues((current) => ({ ...current, [id]: value }));

    if (id === "start" || id === "end") {
      clearErrors("start", "end", "deadline");
    } else if (id === "deadline") {
      clearErrors("deadline");
    } else if (id === "minimum" || id === "capacity") {
      clearErrors("minimum", "capacity");
    } else if (id === "title") {
      clearErrors("title");
    } else if (id === "place") {
      clearErrors("place");
    }
  };

  const postMeetup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateMeetupForm(values);
    const firstError = Object.keys(nextErrors)[0] as keyof CreateFormErrors | undefined;

    if (firstError) {
      setErrors(nextErrors);
      window.requestAnimationFrame(() => {
        const targetId = firstError === "start" || firstError === "end" || firstError === "deadline"
          ? `${firstError}-trigger`
          : firstError === "place"
            ? "place-trigger"
            : firstError;
        document.getElementById(targetId)?.focus();
      });
      return;
    }
    if (isPosting) {
      return;
    }

    setErrors({});
    setIsPosting(true);
    setNavigationIntent("push", "/meetups/new?posted=1");
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
            label={`${getTimeLabel(values.start, timeOptions)} · ${values.place?.name ?? "장소 미정"}`}
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

  const errorMessages = Object.values(errors);

  return (
    <ScreenShell bottomSpacing aria-label="모임 만들기 검토">
      <TopNavigation className="sticky top-0 z-20 border-b border-[var(--stroke-neutral)] bg-[var(--bg-layer-default)]" href="/" title="모임 만들기" />
      <form className="px-[var(--dimension-x5)] pb-8 pt-5" id="create-meetup-form" noValidate onSubmit={postMeetup}>
        <h2 className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
          어떤 벙개를 열까요?
        </h2>
        <p className="m-0 mt-1 text-[13px] leading-5 text-[var(--fg-muted)]">
          필요한 정보만 빠르게 정하면 바로 모집을 시작해요.
        </p>

        {errorMessages.length > 0 ? (
          <StatusBanner
            className="mt-4 rounded-[12px]"
            tone="critical"
            label={`${errorMessages.length}개 항목을 확인해 주세요.`}
            description={errorMessages[0]}
          />
        ) : null}

        <div className="mt-5 space-y-3">
          <label className="relative block rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 py-2.5 focus-within:border-[var(--fg-neutral)] focus-within:ring-2 focus-within:ring-[var(--fg-neutral)] focus-within:ring-offset-2" htmlFor="activity">
            <span className="block text-[12px] leading-4 text-[var(--fg-muted)]">활동</span>
            <select
              className="mt-1 min-h-[28px] w-full appearance-none bg-transparent pr-8 text-[14px] font-semibold leading-5 text-[var(--fg-neutral)] outline-none"
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
            <ChevronDown className="pointer-events-none absolute bottom-[17px] right-4 text-[var(--fg-muted)]" size={18} strokeWidth={1.8} aria-hidden="true" />
          </label>

          <TextField id="title" label="모임 제목" value={values.title} placeholder="무엇을 함께 할지 적어 주세요" error={errors.title} onChange={(value) => updateValue("title", value)} />
          <TextField id="purpose" label="한 줄 소개" value={values.purpose} placeholder="모임의 분위기와 목적을 알려 주세요" multiline onChange={(value) => updateValue("purpose", value)} />

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold leading-5 text-[var(--fg-neutral)]">언제 만나요?</legend>
            <div className="grid grid-cols-2 gap-2">
              <TimeWheelPicker id="start" label="시작" value={values.start} options={timeOptions.filter((option) => option.offsetMinutes <= 24 * 60)} error={errors.start} onChange={(value) => updateValue("start", value)} />
              <TimeWheelPicker id="end" label="종료" value={values.end} options={timeOptions} error={errors.end} onChange={(value) => updateValue("end", value)} />
            </div>
          </fieldset>

          <PlacePicker id="place" label="장소" value={values.place} error={errors.place} onChange={(place) => updateValue("place", place)} />

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold leading-5 text-[var(--fg-neutral)]">몇 명이 모이면 시작할까요?</legend>
            <div className="grid grid-cols-2 gap-2">
              <NumberField id="minimum" label="최소 성사 인원" value={values.minimum} error={errors.minimum} onChange={(value) => updateValue("minimum", value)} />
              <NumberField id="capacity" label="정원" value={values.capacity} error={errors.capacity} onChange={(value) => updateValue("capacity", value)} />
            </div>
          </fieldset>

          <TextField id="costAlcohol" label="비용·음주" value={values.costAlcohol} placeholder="예: 무료 · 음주 없음" onChange={(value) => updateValue("costAlcohol", value)} />

          <TimeWheelPicker id="deadline" label="성사 여부를 확정할 시간" value={values.deadline} options={timeOptions} error={errors.deadline} onChange={(value) => updateValue("deadline", value)} />
        </div>

        <StatusBanner className="mt-4 rounded-[12px]" tone="positive" label="만들면 바로 첫 참가자 1명으로 시작해요." />

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

function NewMeetupFallback() {
  return (
    <ScreenShell bottomSpacing aria-label="벙개 화면 불러오기">
      <div className="flex flex-1 items-center justify-center px-[var(--dimension-x5)] pb-8 pt-6">
        <p role="status" className="m-0 text-[length:var(--type-body)] leading-5 text-[var(--fg-muted)]">
          화면을 불러오는 중이에요
        </p>
      </div>
    </ScreenShell>
  );
}

export default function NewMeetupPage() {
  return (
    <Suspense fallback={<NewMeetupFallback />}>
      <NewMeetupPageContent />
    </Suspense>
  );
}
