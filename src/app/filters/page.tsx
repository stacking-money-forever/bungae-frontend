"use client";

import { ChevronRight, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type RefObject } from "react";

import {
  AnimatedDialog,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import {
  defaultHomeFilters,
  HomeChrome,
  readFiltersFromSearch,
  serializeHomeFilters,
} from "@/components/home-surface";
import { setNavigationIntent } from "@/components/navigation-intent";

type SelectOption = {
  label: string;
  value: string;
};

const activityOptions: SelectOption[] = [
  { label: "전체", value: "전체" },
  { label: "식사", value: "식사" },
  { label: "산책", value: "산책" },
  { label: "보드게임", value: "보드게임" },
  { label: "카페 대화", value: "카페 대화" },
];

const timeOptions: SelectOption[] = [
  { label: "24시간", value: "24시간" },
  { label: "오늘 저녁", value: "오늘 저녁" },
  { label: "오늘 밤", value: "오늘 밤" },
  { label: "내일 오전", value: "내일 오전" },
];

const distanceOptions: SelectOption[] = [
  { label: "2km 이내", value: "2km 이내" },
  { label: "5km 이내", value: "5km 이내" },
  { label: "거리 제한 없음", value: "거리 제한 없음" },
];

const costAlcoholOptions: SelectOption[] = [
  { label: "무료 · 음주 없음", value: "무료 · 음주 없음" },
  { label: "유료 포함 · 음주 없음", value: "유료 포함 · 음주 없음" },
  { label: "무료 · 음주 있음", value: "무료 · 음주 있음" },
  { label: "전체", value: "전체" },
];

interface FilterSelectRowProps {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLSelectElement | null>;
}

function FilterSelectRow({
  id,
  label,
  value,
  options,
  onChange,
  inputRef,
}: FilterSelectRowProps) {
  return (
    <label
      className="flex min-h-[68px] w-full items-center gap-[var(--dimension-x2)] border-b border-[var(--stroke-neutral)]"
      htmlFor={id}
    >
      <span className="w-[72px] shrink-0 text-[13px] leading-5 text-[var(--fg-muted)]">
        {label}
      </span>
      <span className="relative flex min-w-0 flex-1 items-center">
        <select
          ref={inputRef}
          id={id}
          className="min-h-[44px] min-w-0 flex-1 appearance-none bg-transparent pr-8 text-left text-[length:var(--type-body)] font-semibold leading-[22px] text-[var(--fg-neutral)] outline-none focus-visible:rounded-[var(--dimension-x1)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} 필터`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronRight
          className="pointer-events-none absolute right-0 text-[var(--fg-muted)]"
          size={24}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </span>
    </label>
  );
}

function FiltersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [initialFilters] = useState(() => readFiltersFromSearch(searchParams));
  const [location, setLocation] = useState(initialFilters.location);
  const [activity, setActivity] = useState(initialFilters.activity);
  const [time, setTime] = useState(initialFilters.time);
  const [distance, setDistance] = useState(initialFilters.distance);
  const [costAlcohol, setCostAlcohol] = useState(initialFilters.costAlcohol);
  const [availableOnly, setAvailableOnly] = useState(initialFilters.availableOnly);
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  const firstFilterRef = useRef<HTMLSelectElement>(null);
  const searchKey = searchParams.toString();
  const appliedFiltersRef = useRef(initialFilters);

  useEffect(() => {
    const nextFilters = readFiltersFromSearch(new URLSearchParams(searchKey));
    setLocation(nextFilters.location);
    setActivity(nextFilters.activity);
    setTime(nextFilters.time);
    setDistance(nextFilters.distance);
    setCostAlcohol(nextFilters.costAlcohol);
    setAvailableOnly(nextFilters.availableOnly);
    appliedFiltersRef.current = nextFilters;
  }, [searchKey]);

  const resetFilters = () => {
    setActivity(defaultHomeFilters.activity);
    setTime(defaultHomeFilters.time);
    setDistance(defaultHomeFilters.distance);
    setCostAlcohol(defaultHomeFilters.costAlcohol);
    setAvailableOnly(defaultHomeFilters.availableOnly);
  };

  const closeSheet = () => {
    appliedFiltersRef.current = filters;
    setIsSheetOpen(false);
  };

  const filters = {
    location,
    activity,
    time,
    distance,
    costAlcohol,
    availableOnly,
  };

  const navigateHome = () => {
    const queryString = serializeHomeFilters(appliedFiltersRef.current);
    const target = queryString ? `/?${queryString}` : "/";
    setNavigationIntent("sheet", target);
    router.push(target);
  };

  return (
    <>
      <div
        aria-hidden="true"
        inert
        data-testid="filter-home-surface"
      >
        <main className="app-viewport">
          <div className="home-shell">
            <HomeChrome filters={filters} />
          </div>
        </main>
      </div>

      <AnimatedDialog
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onExitComplete={navigateHome}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          firstFilterRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="flex h-[min(594px,calc(100dvh-16px))] max-h-[calc(100dvh-16px)] !overflow-hidden flex-col"
      >
            <div className="mt-5 flex min-h-[52px] items-center justify-between">
              <AnimatedDialogTitle asChild>
                <h1
                  className="font-display text-[length:var(--type-page-title)] font-normal leading-6 text-[var(--fg-neutral)]"
                >
                  필터
                </h1>
              </AnimatedDialogTitle>
              <button
                className="inline-flex min-h-[44px] items-center gap-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)] focus-visible:rounded-[var(--dimension-x1)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)]"
                type="button"
                onClick={resetFilters}
              >
                <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>초기화</span>
              </button>
            </div>

            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <FilterSelectRow
                id="filter-activity"
                label="활동"
                value={activity}
                options={activityOptions}
                onChange={setActivity}
                inputRef={firstFilterRef}
              />
              <FilterSelectRow
                id="filter-time"
                label="시간"
                value={time}
                options={timeOptions}
                onChange={setTime}
              />
              <FilterSelectRow
                id="filter-distance"
                label="거리"
                value={distance}
                options={distanceOptions}
                onChange={setDistance}
              />
              <FilterSelectRow
                id="filter-cost-alcohol"
                label="비용·음주"
                value={costAlcohol}
                options={costAlcoholOptions}
                onChange={setCostAlcohol}
              />
            </div>

            <div className="flex min-h-[64px] items-center justify-between gap-3">
              <span className="text-[length:var(--type-body)] font-semibold leading-[22px] text-[var(--fg-neutral)]">
                참여 가능한 모임만 보기
              </span>
              <button
                className={`inline-flex min-h-[44px] min-w-[64px] items-center rounded-full p-1 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 ${
                  availableOnly
                    ? "justify-end bg-[var(--fg-neutral)]"
                    : "justify-start border border-[var(--stroke-neutral)] bg-[var(--bg-layer-default)]"
                }`}
                type="button"
                role="switch"
                aria-checked={availableOnly}
                aria-label="참여 가능한 모임만 보기"
                onClick={() => setAvailableOnly((current) => !current)}
              >
                <motion.span
                  layout
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "tween", duration: 0.16, ease: "easeOut" }
                  }
                  className={`size-9 rounded-full ${
                    availableOnly
                      ? "bg-[var(--bg-layer-floating)]"
                      : "bg-[var(--fg-muted)]"
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>

            <AnimatedDialogDescription asChild>
              <p className="m-0 pb-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
                현재 위치를 기준으로 가까운 모임을 찾아요.
              </p>
            </AnimatedDialogDescription>

            <button
              className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              type="button"
              onClick={closeSheet}
            >
              필터 적용
            </button>
      </AnimatedDialog>
    </>
  );
}

export default function FiltersPage() {
  return (
    <Suspense
      fallback={
        <main className="app-viewport">
          <div className="home-shell">
            <HomeChrome filters={defaultHomeFilters} />
          </div>
        </main>
      }
    >
      <FiltersPageContent />
    </Suspense>
  );
}
