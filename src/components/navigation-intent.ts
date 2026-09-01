"use client";

export type NavigationIntent = "push" | "pop" | "tab" | "sheet" | "replace";

const navigationIntents = new Set<NavigationIntent>([
  "push",
  "pop",
  "tab",
  "sheet",
  "replace",
]);

let pendingNavigationIntent: NavigationIntent | null = null;
let pendingNavigationTarget: string | null = null;
let pendingNavigationSourceRoute: string | null = null;
let pendingNavigationVersion = 0;

export interface NavigationIntentState {
  intent: NavigationIntent | null;
  target: string | null;
  sourceRoute: string | null;
  version: number;
}

export function getNavigationIntentState(): NavigationIntentState {
  return {
    intent: pendingNavigationIntent,
    target: pendingNavigationTarget,
    sourceRoute: pendingNavigationSourceRoute,
    version: pendingNavigationVersion,
  };
}

export function clearPendingNavigationIntent() {
  pendingNavigationIntent = null;
  pendingNavigationTarget = null;
  pendingNavigationSourceRoute = null;
  pendingNavigationVersion += 1;
}

export function normalizeSearch(search: string) {
  const serializedSearch = new URLSearchParams(search).toString();
  return serializedSearch ? `?${serializedSearch}` : "";
}

export function getNormalizedNavigationTarget(target: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const destination = new URL(target, window.location.href);
    return `${destination.pathname}${normalizeSearch(destination.search)}${destination.hash}`;
  } catch {
    return null;
  }
}

export function getRouteNavigationTarget(target: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const normalizedTarget = getNormalizedNavigationTarget(target);
    if (normalizedTarget === null) {
      return null;
    }

    const destination = new URL(normalizedTarget, window.location.href);
    return `${destination.pathname}${normalizeSearch(destination.search)}`;
  } catch {
    return null;
  }
}

export function getCurrentNavigationTarget() {
  if (typeof window === "undefined") {
    return null;
  }

  return getNormalizedNavigationTarget(window.location.href) ??
    `${window.location.pathname}${window.location.hash}`;
}

export function getCurrentRouteNavigationTarget() {
  if (typeof window === "undefined") {
    return null;
  }

  return getRouteNavigationTarget(window.location.href) ?? window.location.pathname;
}

export function getInternalNavigationTarget(target: EventTarget | null): string | null {
  if (
    typeof window === "undefined" ||
    !(target instanceof Element)
  ) {
    return null;
  }

  const anchor = target.closest<HTMLAnchorElement>("a[href]");

  if (!anchor) {
    return null;
  }

  let destination: URL;
  try {
    destination = new URL(anchor.getAttribute("href") ?? "", window.location.href);
  } catch {
    return null;
  }

  if (destination.origin !== window.location.origin) {
    return null;
  }

  return getNormalizedNavigationTarget(destination.href);
}

export function getNavigationIntent(target: EventTarget | null): NavigationIntent | null {
  if (
    typeof window === "undefined" ||
    !(target instanceof Element)
  ) {
    return null;
  }

  if (getInternalNavigationTarget(target) === null) {
    return null;
  }

  const anchor = target.closest<HTMLAnchorElement>("a[href]");

  if (!anchor) {
    return null;
  }

  if (anchor.closest(".bottom-navigation")) {
    return "tab";
  }

  const explicitIntent = anchor.dataset.transition;
  if (
    anchor.getAttribute("aria-label") === "뒤로가기" ||
    explicitIntent === "pop"
  ) {
    return "pop";
  }

  if (explicitIntent && navigationIntents.has(explicitIntent as NavigationIntent)) {
    return explicitIntent as NavigationIntent;
  }

  return "push";
}

export function setNavigationIntent(intent: NavigationIntent, target?: string) {
  const currentRoute = getCurrentRouteNavigationTarget();
  const normalizedTarget = target ? getNormalizedNavigationTarget(target) : null;

  // A programmatic intent is only actionable for a different route. Clearing
  // same-route requests here prevents a no-op router call from leaking its
  // animation intent into a later navigation.
  if (
    normalizedTarget !== null &&
    getRouteNavigationTarget(normalizedTarget) === currentRoute
  ) {
    clearPendingNavigationIntent();
    return;
  }

  pendingNavigationIntent = intent;
  pendingNavigationTarget = normalizedTarget;
  pendingNavigationSourceRoute = currentRoute;
  pendingNavigationVersion += 1;
}
