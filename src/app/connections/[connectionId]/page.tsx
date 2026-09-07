import type { Metadata, Viewport } from "next";
import Link from "next/link";

import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { connectionCapabilities } from "@/lib/ui/conversation-capabilities";

export const metadata: Metadata = {
  title: "연결 상세",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Connection detail route. The `/v1/connections/{connectionId}` detail and
 * 1:1 message contracts are not implemented (`docs/API_CONTRACT.md` rows
 * 349-352 are proposals), so this surface renders an honest unavailable state
 * with recovery links. It never fabricates a counterpart, message history,
 * send success, or realtime connection.
 */
export default function ConnectionDetailPage() {
  const capabilities = connectionCapabilities();
  const sendUnavailable = capabilities.send.state === "unavailable";
  const realtimeUnavailable = capabilities.realtime.state === "unavailable";
  const reportUnavailable = capabilities.reportMessage.state === "unavailable";
  const blockUnavailable = capabilities.blockCounterpart.state === "unavailable";

  return (
    <ScreenShell className="px-5 pb-8" aria-label="연결 상세">
      <TopNavigation href="/connections" title="연결 상세" />
      <section className="pt-10" aria-labelledby="connection-detail-heading">
        <h1 id="connection-detail-heading" className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
          연결 상세를 확인할 수 없어요
        </h1>
        <p className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          이 화면은 연결 한 건의 상세 계약이 제공되면 상대 정보와 함께 표시돼요. 지금은 연결 목록에서 확인한 정보만 제공되고 있어요.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="connection-unavailable-capabilities">
        <h2 id="connection-unavailable-capabilities" className="sr-only">사용할 수 없는 연결 기능</h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {sendUnavailable ? (
            <li className="rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              1:1 메시지 보내기는 아직 제공되지 않아요.
            </li>
          ) : null}
          {realtimeUnavailable ? (
            <li className="rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              실시간 대화 알림은 아직 제공되지 않아요.
            </li>
          ) : null}
          {reportUnavailable || blockUnavailable ? (
            <li className="rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              상대 신고·차단은 상대 정보 계약이 제공된 뒤 가능해요.
            </li>
          ) : null}
        </ul>
      </section>

      <nav className="mt-8" aria-label="연결 복구 경로">
        <ul className="m-0 grid list-none gap-2 p-0">
          <li>
            <Link
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href="/connections"
            >
              연결 목록으로
            </Link>
          </li>
          <li>
            <Link
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href="/"
            >
              홈으로
            </Link>
          </li>
        </ul>
      </nav>
    </ScreenShell>
  );
}
