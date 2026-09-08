import type { HTMLAttributes, ReactNode } from "react";

export interface ScreenShellProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  children: ReactNode;
  /** Reserve room for a fixed BottomActionBar. */
  bottomSpacing?: boolean;
  /** Number of stacked 52px actions in the fixed bar. */
  actionCount?: number;
  /** Add the tab-bar occupied height when this route also shows bottom nav. */
  reserveTabBar?: boolean;
}

function occupiedBottomClass(actionCount: number, reserveTabBar: boolean) {
  if (actionCount <= 0 && !reserveTabBar) return undefined;
  if (actionCount <= 0) return "pb-[var(--tab-bar-occupied-height)]";
  const gaps = Math.max(actionCount - 1, 0);
  const actionStack = `(var(--action-primary-height)*${actionCount})+(var(--dimension-x2)*${gaps})+var(--dimension-x3)+1px`;
  if (reserveTabBar) {
    return `pb-[calc(${actionStack}+var(--dimension-x6)+var(--tab-bar-occupied-height))]`;
  }
  return `pb-[calc(${actionStack}+max(var(--dimension-x6),var(--safe-area-bottom)))]`;
}

export function ScreenShell({
  children,
  bottomSpacing = false,
  actionCount,
  reserveTabBar = false,
  className,
  ...rest
}: ScreenShellProps) {
  const resolvedActionCount = actionCount ?? (bottomSpacing ? 1 : 0);
  const shellClassName = [
    "relative mx-auto flex min-h-[100svh] w-full max-w-[var(--screen-product-width)] flex-col overflow-x-clip bg-[var(--bg-layer-default)] text-[var(--fg-neutral)]",
    occupiedBottomClass(resolvedActionCount, reserveTabBar),
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
