"use client";

import { useEffect, useRef } from "react";

import type { LiveRegionKind } from "@/lib/ui/live-region";

export interface ScreenLoadingProps {
  variant: "list" | "detail" | "form" | "conversation";
  className?: string;
}

const variantGeometry: Record<
  ScreenLoadingProps["variant"],
  { aria: string; rows: number; wide: boolean }
> = {
  list: { aria: "목록", rows: 3, wide: false },
  detail: { aria: "상세 내용", rows: 4, wide: false },
  form: { aria: "입력 화면", rows: 4, wide: true },
  conversation: { aria: "대화", rows: 4, wide: true },
};

function announce(kind: LiveRegionKind, label: string): void {
  let region = document.querySelector<HTMLElement>("[data-screen-loading-live]");
  if (!region) {
    region = document.createElement("div");
    region.dataset.screenLoadingLive = "";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", kind === "assertive" ? "assertive" : "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only";
    document.body.append(region);
  }
  region.textContent = label;
}

/**
 * Static geometry placeholder for route/code loading. It never suspends
 * again, never invents data, and never fabricates account/result state.
 * Decorative rows are hidden from assistive tech.
 */
export function ScreenLoading({ variant, className }: ScreenLoadingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const geometry = variantGeometry[variant];

  useEffect(() => {
    announce("polite", `화면을 불러오는 중이에요. ${geometry.aria} 준비 중`);
    return () => {
      document.querySelectorAll("[data-screen-loading-live]").forEach((node) => {
        node.textContent = "";
      });
    };
  }, [geometry.aria]);

  const rows = Array.from({ length: geometry.rows }, (_, index) => index);

  return (
    <div
      ref={ref}
      data-screen-loading
      className={[
        "w-full",
        variant === "list" || variant === "detail" ? "px-[var(--dimension-x5)] pt-[var(--dimension-x6)]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid gap-[var(--dimension-x3)]" aria-hidden="true">
        {rows.map((row) => (
          <div
            key={row}
            className={[
              "flex items-center gap-[var(--dimension-x3)] rounded-[12px] bg-[var(--bg-neutral-weak)]",
              geometry.wide ? "min-h-[52px]" : "min-h-[64px]",
            ]
              .join(" ")}
          >
            <div className="h-[40px] w-[40px] shrink-0 rounded-[8px] bg-[var(--bg-neutral-pressed)]" />
            <div className="min-w-0 flex-1 pr-[var(--dimension-x4)]">
              <div className="h-[14px] w-[72%] rounded-[4px] bg-[var(--bg-neutral-pressed)]" />
              <div className="mt-2 h-[12px] w-[46%] rounded-[4px] bg-[var(--bg-neutral-pressed)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
