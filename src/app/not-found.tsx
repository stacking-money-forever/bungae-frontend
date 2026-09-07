import Link from "next/link";

/**
 * Unknown URL / missing resource recovery. Does not distinguish
 * nonexistent from forbidden content and never leaks resource ids.
 */
export default function NotFound() {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <section className="flex min-h-[70svh] flex-col items-center justify-center px-[var(--dimension-x5)] py-12 text-center">
          <h1 className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
            찾을 수 없는 화면이에요
          </h1>
          <p className="mx-auto mt-3 max-w-[300px] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            주소가 바뀌었거나 삭제됐을 수 있어요. 벙개 홈과 내 모임에서 계속
            둘러볼 수 있어요.
          </p>
          <nav
            className="mt-6 flex w-full max-w-[280px] flex-col items-stretch gap-[var(--dimension-x2)]"
            aria-label="복구 이동"
          >
            <Link
              className="inline-flex min-h-[var(--action-primary-height)] items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href="/"
            >
              벙개 홈으로
            </Link>
            <Link
              className="inline-flex min-h-[var(--target-min)] items-center justify-center rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href="/my-meetups"
            >
              내 모임 보기
            </Link>
            <Link
              className="inline-flex min-h-[var(--target-min)] items-center justify-center rounded-[12px] px-4 text-[length:var(--type-action)] leading-6 text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href="/auth"
            >
              로그인하기
            </Link>
          </nav>
        </section>
      </div>
    </main>
  );
}
