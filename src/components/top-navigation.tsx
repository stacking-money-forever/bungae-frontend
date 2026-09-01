import Link, { type LinkProps } from "next/link";
import { ArrowLeft } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

export interface TopNavigationProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  href: LinkProps["href"];
  title?: ReactNode;
  trailing?: ReactNode;
  backLabel?: string;
}

export function TopNavigation({
  href,
  title,
  trailing,
  backLabel = "뒤로가기",
  className,
  ...rest
}: TopNavigationProps) {
  const navigationClassName = [
    "flex min-h-[64px] w-full shrink-0 items-center gap-[var(--dimension-x2)] px-[var(--dimension-x5)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={navigationClassName} {...rest}>
      <Link
        className="inline-flex min-h-[var(--target-min)] min-w-[var(--target-min)] shrink-0 items-center justify-center text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[3px]"
        href={href}
        aria-label={backLabel}
      >
        <ArrowLeft size={24} strokeWidth={1.8} aria-hidden="true" />
      </Link>

      {title !== undefined && title !== null ? (
        <h1 className="font-display min-w-0 flex-1 truncate text-[length:var(--type-page-title)] font-normal leading-6 text-[var(--fg-neutral)]">
          {title}
        </h1>
      ) : (
        <span className="min-w-0 flex-1" aria-hidden="true" />
      )}

      {trailing !== undefined && trailing !== null ? (
        <div className="flex min-h-[var(--target-min)] min-w-[var(--target-min)] shrink-0 items-center justify-end">
          {trailing}
        </div>
      ) : null}
    </header>
  );
}
