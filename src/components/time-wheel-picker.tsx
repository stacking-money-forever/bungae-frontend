"use client";

import { Check, ChevronDown } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";

export interface TimeWheelOption {
  value: string;
  label: string;
  offsetMinutes: number;
}

export interface TimeWheelPickerProps {
  id: string;
  label: string;
  value: string;
  options: TimeWheelOption[];
  onChange: (value: string) => void;
  error?: string;
}

export function TimeWheelPicker({
  id,
  label,
  value,
  options,
  onChange,
  error,
}: TimeWheelPickerProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftValue(value);
    const frame = window.requestAnimationFrame(() => {
      optionRefs.current[value]?.scrollIntoView?.({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, reduceMotion, value]);

  const moveSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === draftValue));
    let nextIndex = currentIndex;

    if (event.key === "ArrowDown") {
      nextIndex = Math.min(options.length - 1, currentIndex + 1);
    } else if (event.key === "ArrowUp") {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextValue = options[nextIndex]?.value;
    if (!nextValue) {
      return;
    }
    setDraftValue(nextValue);
    optionRefs.current[nextValue]?.focus();
    optionRefs.current[nextValue]?.scrollIntoView?.({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
  };

  return (
    <div>
      <AnimatedDialog
        open={open}
        onOpenChange={setOpen}
        placement="bottom"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          optionRefs.current[value]?.focus();
        }}
        trigger={
          <button
            id={`${id}-trigger`}
            className={`flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[12px] border bg-[var(--bg-layer-floating)] px-4 py-2.5 text-left outline-none transition-colors hover:border-[var(--fg-muted)] focus-visible:border-[var(--fg-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)] focus-visible:ring-offset-2 ${error ? "border-[var(--fg-critical)]" : "border-[var(--stroke-neutral)]"}`}
            type="button"
            aria-label={`${label}, ${selectedOption?.label ?? "시간 선택"}`}
            aria-describedby={error ? `${id}-error` : undefined}
          >
            <span className="min-w-0">
              <span className="block text-[12px] leading-4 text-[var(--fg-muted)]">{label}</span>
              <span className="mt-0.5 block truncate font-display text-[17px] leading-6 text-[var(--fg-neutral)]">
                {selectedOption?.label ?? "시간 선택"}
              </span>
            </span>
            <ChevronDown className="shrink-0 text-[var(--fg-muted)]" size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        }
      >
        <AnimatedDialogTitle className="m-0 font-display text-[22px] font-normal leading-7 text-[var(--fg-neutral)]">
          {label} 선택
        </AnimatedDialogTitle>
        <AnimatedDialogDescription className="m-0 mt-1 text-[13px] leading-5 text-[var(--fg-muted)]">
          위아래로 움직여 시간을 고르세요.
        </AnimatedDialogDescription>

        <div
          className="mt-4 h-[220px] snap-y snap-mandatory overflow-y-auto rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-default)] py-[88px] outline-none"
          role="listbox"
          aria-label={`${label} 시간`}
          aria-activedescendant={`${id}-option-${draftValue}`}
          onKeyDown={moveSelection}
        >
          {options.map((option) => {
            const selected = draftValue === option.value;
            return (
              <button
                key={option.value}
                ref={(element) => {
                  optionRefs.current[option.value] = element;
                }}
                id={`${id}-option-${option.value}`}
                className={`flex min-h-[44px] w-full snap-center items-center justify-center gap-2 px-4 text-[16px] leading-6 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--fg-neutral)] ${
                  selected
                    ? "bg-[var(--bg-neutral-pressed)] font-bold text-[var(--fg-neutral)]"
                    : "text-[var(--fg-muted)]"
                }`}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setDraftValue(option.value)}
              >
                {selected ? <Check size={17} strokeWidth={2} aria-hidden="true" /> : null}
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <AnimatedDialogClose asChild>
            <button
              className="min-h-[48px] rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-[14px] font-semibold text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              type="button"
            >
              취소
            </button>
          </AnimatedDialogClose>
          <button
            className="min-h-[48px] rounded-[12px] bg-[var(--brand-accent)] px-4 text-[14px] font-bold text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
            onClick={() => {
              onChange(draftValue);
              setOpen(false);
            }}
          >
            적용
          </button>
        </div>
      </AnimatedDialog>
      {error ? (
        <p id={`${id}-error`} className="m-0 mt-1.5 text-[12px] leading-4 text-[var(--fg-critical)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
