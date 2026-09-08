export function connectionIntentStateLabel(state: "PENDING" | "MATCHED") {
  return state === "MATCHED" ? "서로 연결됐어요" : "상대에게는 아직 보이지 않아요";
}

export const chromeButtonClassName =
  "inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const chromePrimaryButtonClassName =
  "inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
