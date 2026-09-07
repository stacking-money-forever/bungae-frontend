"use client";

import type { Message } from "@/lib/api/types";

export interface ConversationMessageListProps {
  messages: Message[];
  currentUserId: string | null;
  onLoadOlder: (() => void) | null;
  loadingOlder: boolean;
  appendError: string | null;
}

/**
 * Ordered message presentation shared by group chat and (unavailable) 1:1
 * chat. Pure rendering: no send, no polling, no local receipts, no invented
 * authors, no auto-scroll (scroll/anchor ownership stays with each screen's
 * scroll container). Rows never run raw text as HTML.
 */
export function ConversationMessageList({
  messages,
  currentUserId,
  onLoadOlder,
  loadingOlder,
  appendError,
}: ConversationMessageListProps) {
  return (
    <ol aria-label="대화 메시지" className="m-0 flex list-none flex-col gap-3 p-0">
      {onLoadOlder ? (
        <li className="flex justify-center">
          <button
            type="button"
            className="min-h-[44px] px-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            onClick={() => onLoadOlder()}
            disabled={loadingOlder}
          >
            {loadingOlder ? "메시지를 더 불러오는 중…" : "메시지 더 보기"}
          </button>
        </li>
      ) : null}
      {appendError ? (
        <li className="flex justify-center">
          <div role="alert" className="flex min-w-0 flex-col items-center gap-2 px-2 text-center">
            <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">{appendError}</p>
            {onLoadOlder ? (
              <button
                type="button"
                className="min-h-[44px] px-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                onClick={() => onLoadOlder()}
                disabled={loadingOlder}
              >
                메시지 더 보기 다시 시도
              </button>
            ) : null}
          </div>
        </li>
      ) : null}
      {messages.map((message) => {
        const mine = currentUserId !== null && message.sender.userId === currentUserId;
        return (
          <li key={message.id} className={`flex min-w-0 ${mine ? "justify-end" : "justify-start"}`}>
            <article className={`flex max-w-[86%] min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
              <span className="mb-1 max-w-full truncate px-1 text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">
                {message.sender.displayName}
              </span>
              <p className="m-0 w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl bg-[var(--bg-layer-floating)] px-4 py-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)] [overflow-wrap:anywhere]">
                {message.text}
              </p>
              <time
                className="mt-1 px-1 text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]"
                dateTime={message.createdAt}
              >
                {formatTime(message.createdAt)}
              </time>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

function formatTime(createdAt: string): string {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? "시각을 확인할 수 없어요"
    : date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}
