"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, ChevronRight, RotateCcw, Timer, Zap } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { setNavigationIntent } from "@/components/navigation-intent";
import { ScreenShell } from "@/components/screen-shell";

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
  { label: "오늘", value: "오늘" },
  { label: "지금부터 3시간", value: "지금부터 3시간" },
  { label: "내일", value: "내일" },
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
}

function FilterSelectRow({
  id,
  label,
  value,
  options,
  onChange,
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

export default function FiltersPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [activity, setActivity] = useState("전체");
  const [time, setTime] = useState("오늘");
  const [distance, setDistance] = useState("2km 이내");
  const [costAlcohol, setCostAlcohol] = useState("무료 · 음주 없음");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  const filterHeadingRef = useRef<HTMLHeadingElement>(null);

  const resetFilters = () => {
    setActivity("전체");
    setTime("오늘");
    setDistance("2km 이내");
    setCostAlcohol("무료 · 음주 없음");
    setAvailableOnly(true);
  };

  const closeSheet = () => {
    setIsSheetOpen(false);
  };

  const navigateHome = () => {
    setNavigationIntent("sheet", "/");
    router.push("/");
  };

  const resultCount = availableOnly ? 3 : 4;

  return (
    <Dialog.Root open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <ScreenShell aria-label="모임 필터">
      <div
        aria-hidden={isSheetOpen ? true : undefined}
        inert={isSheetOpen}
        className="min-h-[280px] px-[var(--dimension-x5)] pt-6 opacity-70"
      >
        <div className="flex items-center justify-between">
          <Link className="flex min-h-[44px] items-center gap-2" href="/">
            <span className="flex size-10 items-center justify-center rounded-[var(--dimension-x2)] bg-[var(--brand-accent)] text-[var(--fg-on-brand)]">
              <Zap size={22} strokeWidth={2.2} />
            </span>
            <span className="font-display text-[length:var(--type-wordmark)] leading-6">벙개</span>
          </Link>
          <span className="flex size-11 items-center justify-center text-[var(--fg-muted)]">
            <ChevronDown size={22} strokeWidth={1.8} />
          </span>
        </div>
        <p className="mt-3 font-display text-[length:var(--type-page-title)] leading-6">마포구 망원동</p>
        <div className="mt-2 flex min-h-[44px] items-center justify-between border-b border-[var(--stroke-neutral)] text-[length:var(--type-body)] leading-[22px]">
          <span>오늘 · 2km · 무료</span>
          <span className="text-[var(--fg-muted)]">필터 변경</span>
        </div>
        <div className="mt-5 flex min-h-[64px] items-center gap-3 border-b border-[var(--stroke-neutral)]">
          <Timer size={24} strokeWidth={1.8} />
          <span className="text-[length:var(--type-body)] leading-[22px]">가장 빠른 모임은 18:30에 시작해요</span>
        </div>
      </div>

      <Dialog.Portal forceMount>
        <AnimatePresence onExitComplete={navigateHome}>
          {isSheetOpen ? (
            <Dialog.Overlay key="filter-backdrop" forceMount asChild>
              <motion.div
                className="fixed inset-0 z-20 bg-[var(--fg-neutral)]"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 0.2 }}
                exit={{ opacity: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "tween", duration: 0.18, ease: "easeOut" }
                }
                aria-hidden="true"
                data-testid="filter-backdrop"
              />
            </Dialog.Overlay>
          ) : null}
          {isSheetOpen ? (
            <Dialog.Content key="filter-sheet"
              forceMount
              asChild
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                filterHeadingRef.current?.focus();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
              }}
            >
              <motion.section
                className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-h-[calc(100svh-120px)] min-h-[594px] w-full max-w-[var(--screen-product-width)] flex-col overflow-y-auto rounded-t-[24px] bg-[var(--bg-layer-floating)] px-[var(--dimension-x5)] pb-[max(var(--dimension-x5),env(safe-area-inset-bottom))] pt-3"
                aria-modal="true"
                initial={reduceMotion ? false : { y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        type: "tween",
                        duration: 0.26,
                        ease: [0.2, 0.8, 0.2, 1],
                      }
                }
              >
            <div className="mx-auto h-1 w-16 shrink-0 rounded-full bg-[var(--stroke-neutral)]" />
            <div className="mt-5 flex min-h-[52px] items-center justify-between">
              <Dialog.Title asChild>
                <h1
                  ref={filterHeadingRef}
                  tabIndex={-1}
                  className="font-display text-[length:var(--type-page-title)] font-normal leading-6 text-[var(--fg-neutral)]"
                >
                  필터
                </h1>
              </Dialog.Title>
              <button
                className="inline-flex min-h-[44px] items-center gap-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)] focus-visible:rounded-[var(--dimension-x1)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)]"
                type="button"
                onClick={resetFilters}
              >
                <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>초기화</span>
              </button>
            </div>

            <div className="mt-2">
              <FilterSelectRow
                id="filter-activity"
                label="활동"
                value={activity}
                options={activityOptions}
                onChange={setActivity}
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

            <Dialog.Description asChild>
              <p className="m-0 pb-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
                현재 위치를 기준으로 가까운 모임을 찾아요.
              </p>
            </Dialog.Description>

            <button
              className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              type="button"
              onClick={closeSheet}
            >
              결과 {resultCount}개 보기
            </button>
              </motion.section>
            </Dialog.Content>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
      </ScreenShell>
    </Dialog.Root>
  );
}
