"use client";

import { Send } from "lucide-react";
import { useRef, type KeyboardEvent, type FormEvent } from "react";

export interface ConversationComposerProps {
  draft: string;
  onDraftChange: (next: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  /** 1..maxLength trimmed validation applied by the parent state owner. */
  maxLength?: number;
}

/**
 * Message composer shared by group chat and (unavailable) 1:1 chat.
 * - IME-safe: Enter is ignored while a Korean composition session is open.
 * - Enter submits after the composition closes; Shift+Enter inserts a newline.
 * - The draft lives in the parent so failures/account switches keep it.
 * - `disabledReason` is announced to assistive tech; the send button stays
 *   visible with an honest reason instead of a fake enabled state.
 */
export function ConversationComposer({
  draft,
  onDraftChange,
  onSend,
  disabled = false,
  disabledReason,
  maxLength = 2000,
}: ConversationComposerProps) {
  const composingRef = useRef(false);

  const submit = () => {
    if (disabled || composingRef.current) return;
    const text = draft.trim();
    if (text.length < 1 || text.length > maxLength) return;
    onSend(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      composingRef.current = true;
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const handleKeyUp = () => {
    composingRef.current = false;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const canSubmit = !disabled && draft.trim().length >= 1 && draft.trim().length <= maxLength;

  return (
    <form className="flex min-w-0 items-end gap-2" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="conversation-draft">
        메시지
      </label>
      <textarea
        id="conversation-draft"
        className="min-h-[44px] min-w-0 flex-1 resize-y rounded-[14px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 py-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)] outline-none placeholder:text-[var(--fg-muted)] focus-visible:border-[var(--fg-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)] disabled:opacity-60"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        rows={1}
        maxLength={maxLength + 1}
        placeholder={disabled ? "메시지를 보낼 수 없어요" : "메시지 보내기"}
        disabled={disabled}
        aria-disabled={disabled}
        aria-describedby={disabled && disabledReason ? "conversation-draft-hint" : undefined}
        aria-label="메시지 입력"
      />
      {disabled && disabledReason ? (
        <span id="conversation-draft-hint" className="sr-only" role="note">
          {disabledReason}
        </span>
      ) : null}
      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--fg-on-brand)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
        aria-label="메시지 보내기"
      >
        <Send size={22} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </form>
  );
}
