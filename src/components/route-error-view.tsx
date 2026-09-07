import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

export interface RouteErrorViewProps {
  /** Privacy-safe user-facing explanation. Never raw error payloads. */
  label: string;
  /** Optional supplementary guidance (ReactNode keeps copy composable). */
  description?: ReactNode;
  /** Re-renders the failed subtree (route segment reset). */
  onReset?: () => void;
  resetLabel?: string;
  /** Same-origin escape navigation for repeated failures. */
  escapeHref?: string;
  escapeLabel?: string;
  /** Section heading id so a boundary can announce it via aria-labelledby. */
  headingId?: string;
}

/**
 * Provider-free recovery surface used by `error.tsx` boundaries and family
 * segments. Distinguishes retry (reset) from hard escape (home/my-meetups)
 * and focuses its heading once mounted so assistive tech lands on context.
 */
export function RouteErrorView({
  label,
  description,
  onReset,
  resetLabel = "다시 시도",
  escapeHref,
  escapeLabel = "홈으로 돌아가기",
  headingId = "route-error-heading",
}: RouteErrorViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      className="flex min-h-[70svh] flex-col items-center justify-center px-[var(--dimension-x5)] py-12 text-center"
      role="alert"
      aria-labelledby={headingId}
    >
      <h1
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)] outline-none"
      >
        {label}
      </h1>
      {description !== undefined && description !== null ? (
        <p className="mx-auto mt-3 max-w-[300px] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          {description}
        </p>
      ) : null}
      <div className="mt-6 flex w-full max-w-[280px] flex-col items-stretch gap-[var(--dimension-x2)]">
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[var(--action-primary-height)] items-center justify-center gap-2 rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          >
            <RotateCw size={18} strokeWidth={1.8} aria-hidden="true" />
            {resetLabel}
          </button>
        ) : null}
        {escapeHref ? (
          <Link
            className="inline-flex min-h-[var(--target-min)] items-center justify-center rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            href={escapeHref}
          >
            {escapeLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
