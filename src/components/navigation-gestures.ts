export const TAB_GESTURE_EVENT = "bungae:tab-gesture";

export const tabDestinations = ["/", "/my-meetups", "/notifications"] as const;

export type GestureAxis = "pending" | "horizontal" | "vertical";

export type TabGestureDetail =
  | { phase: "update"; x: number }
  | { phase: "cancel" }
  | { phase: "commit"; direction: -1 | 1; target: string };

export function getGestureAxis(
  deltaX: number,
  deltaY: number,
  deadZone = 8,
): GestureAxis {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < deadZone) {
    return "pending";
  }

  return Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
}

export function shouldCommitHorizontalGesture(
  deltaX: number,
  elapsedMs: number,
  distanceThreshold = 96,
  velocityThreshold = 0.6,
) {
  const velocity = Math.abs(deltaX) / Math.max(elapsedMs, 1);
  return Math.abs(deltaX) >= distanceThreshold || velocity >= velocityThreshold;
}

export function getAdjacentTabDestination(pathname: string, deltaX: number) {
  const currentIndex = tabDestinations.indexOf(
    pathname as (typeof tabDestinations)[number],
  );
  if (currentIndex === -1 || deltaX === 0) {
    return null;
  }

  const direction = deltaX < 0 ? 1 : -1;
  return tabDestinations[currentIndex + direction] ?? null;
}

export function isRootTabPath(pathname: string) {
  return tabDestinations.includes(pathname as (typeof tabDestinations)[number]);
}

export function isSwipeGestureBlockedTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "a, button, input, select, textarea, summary, [role='button'], [role='dialog'], [data-no-page-swipe]",
      ),
    )
  );
}

export function dispatchTabGesture(detail: TabGestureDetail) {
  window.dispatchEvent(new CustomEvent<TabGestureDetail>(TAB_GESTURE_EVENT, { detail }));
}
