"use client";

import { ArrowDown } from "lucide-react";

export interface NewMessagesBadgeProps {
  count: number;
  onShow: () => void;
  disabled?: boolean;
}

/**
 * New-message affordance while the reader is above the newest anchor. Counts
 * come from the view state machine (test adapters), never from timers or
 * polling. Clicking re-anchors the scroll container to the newest message.
 */
export function NewMessagesBadge({ count, onShow, disabled = false }: NewMessagesBadgeProps) {
  if (count <= 0) return null;
  const label = count === 1 ? "새 메시지 1개" : `새 메시지 ${count}개`;
  return (
    <div className="flex justify-center">
      <button
        type="button"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-body)] font-semibold leading-[22px] text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:opacity-60"
        onClick={onShow}
        disabled={disabled}
      >
        <ArrowDown size={16} strokeWidth={1.8} aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}
