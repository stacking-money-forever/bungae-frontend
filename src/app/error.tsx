"use client";

import { RouteErrorView } from "@/components/route-error-view";

/**
 * Route subtree render failure. `reset` re-renders this subtree; it never
 * claims a server read or mutation succeeded. Raw error details and digests
 * are never shown to the user.
 */
export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorView
      label="화면을 표시하지 못했어요"
      description="잠시 후 다시 시도해 주세요. 다시 시도해도 같은 문제가 반복되면 홈으로 돌아가 다른 메뉴를 이용해 주세요."
      onReset={() => reset()}
      resetLabel="다시 시도"
      escapeHref="/"
      escapeLabel="홈으로 돌아가기"
    />
  );
}
