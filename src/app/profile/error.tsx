"use client";

import { RouteErrorView } from "@/components/route-error-view";

/**
 * Profile/account family error boundary. Never re-reads the failed profile
 * provider; recovery routes to safe origin pages.
 */
export default function ProfileError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <RouteErrorView
          label="계정 화면을 표시하지 못했어요"
          description="다시 시도해 주세요. 반복되면 로그인 화면에서 상태를 확인할 수 있어요."
          onReset={() => reset()}
          resetLabel="다시 시도"
          escapeHref="/auth"
          escapeLabel="로그인 화면으로"
          headingId="profile-error-heading"
        />
      </div>
    </main>
  );
}
