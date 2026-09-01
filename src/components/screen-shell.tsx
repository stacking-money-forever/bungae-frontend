import type { HTMLAttributes, ReactNode } from "react";

export interface ScreenShellProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  children: ReactNode;
  /** Reserve room for a fixed BottomActionBar. */
  bottomSpacing?: boolean;
}

export function ScreenShell({
  children,
  bottomSpacing = false,
  className,
  ...rest
}: ScreenShellProps) {
  const shellClassName = [
    "relative mx-auto flex min-h-[100svh] w-full max-w-[var(--screen-product-width)] flex-col overflow-x-hidden bg-[var(--bg-layer-default)] text-[var(--fg-neutral)]",
    bottomSpacing
      ? "pb-[calc(var(--action-primary-height)+var(--dimension-x3)+var(--dimension-x6))]"
      : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={shellClassName} {...rest}>
      {children}
    </main>
  );
}
