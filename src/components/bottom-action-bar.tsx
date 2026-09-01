import type { HTMLAttributes, ReactNode } from "react";

export interface BottomActionBarProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  children: ReactNode;
}

export function BottomActionBar({
  children,
  className,
  ...rest
}: BottomActionBarProps) {
  const actionBarClassName = [
    "fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-[var(--screen-product-width)] flex-col items-stretch gap-[var(--dimension-x2)] border-t border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-[var(--dimension-x5)] pt-[var(--dimension-x3)] pb-[max(var(--dimension-x6),env(safe-area-inset-bottom))]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <footer className={actionBarClassName} aria-label="화면 주요 행동" {...rest}>
      {children}
    </footer>
  );
}
