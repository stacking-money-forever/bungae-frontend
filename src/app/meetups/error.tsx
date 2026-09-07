"use client";

import { RouteErrorView } from "@/components/route-error-view";

/**
 * Meetup creation/flow family error boundary. Isolates form/flow failures
 * near their segment; recovery never re-enters the failed provider surface.
 */
export default function MeetupsError({
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
          description="입력한 내용이 저장되지 않았을 수 있어요. 다시 시도하거나 내 모임에서 상태를 확인해 주세요."
          onReset={() => reset()}
          resetLabel="다시 시도"
          escapeHref="/my-meetups"
          escapeLabel="내 모임 보기"
          headingId="meetups-error-heading"
        />
      </div>
    </main>
  );
}
