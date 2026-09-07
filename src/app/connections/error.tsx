"use client";

import { RouteErrorView } from "@/components/route-error-view";

/**
 * Connections family error boundary. Recovery never fabricates connection
 * state and routes to safe origin pages.
 */
export default function ConnectionsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <RouteErrorView
          label="연결 화면을 표시하지 못했어요"
          description="다시 시도해 주세요. 반복되면 홈에서 다시 시작할 수 있어요."
          onReset={() => reset()}
          resetLabel="다시 시도"
          escapeHref="/"
          escapeLabel="홈으로 돌아가기"
          headingId="connections-error-heading"
        />
      </div>
    </main>
  );
}
