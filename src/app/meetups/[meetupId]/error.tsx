"use client";

import { RouteErrorView } from "@/components/route-error-view";

/**
 * Meetup detail/action segment error boundary. The recovery surface never
 * depends on the failed provider that threw inside this subtree.
 */
export default function MeetupError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <RouteErrorView
          label="모임 화면을 표시하지 못했어요"
          description="모임 상태를 다시 확인하려면 다시 시도하거나 목록에서 들어와 주세요."
          onReset={() => reset()}
          resetLabel="다시 시도"
          escapeHref="/my-meetups"
          escapeLabel="내 모임 보기"
          headingId="meetup-error-heading"
        />
      </div>
    </main>
  );
}
