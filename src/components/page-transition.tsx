"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import {
  clearPendingNavigationIntent,
  getCurrentNavigationTarget,
  getCurrentRouteNavigationTarget,
  getInternalNavigationTarget,
  getNavigationIntent,
  getNavigationIntentState,
  getRouteNavigationTarget,
  normalizeSearch,
  setNavigationIntent,
} from "./navigation-intent";
import type { NavigationIntent } from "./navigation-intent";

export {
  clearPendingNavigationIntent,
  getCurrentNavigationTarget,
  getCurrentRouteNavigationTarget,
  getInternalNavigationTarget,
  getNavigationIntent,
  getNavigationIntentState,
  getNormalizedNavigationTarget,
  getRouteNavigationTarget,
  normalizeSearch,
  setNavigationIntent,
} from "./navigation-intent";
export type { NavigationIntent } from "./navigation-intent";

const standardEase = [0.2, 0.8, 0.2, 1] as const;
const historyStateKey = "__bungae_navigation";

type HistoryState = Record<string, unknown>;

function readHistoryEntryIndex(state: unknown): number | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }

  const metadata = (state as HistoryState)[historyStateKey];
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    typeof (metadata as HistoryState).index === "number" &&
    Number.isSafeInteger((metadata as HistoryState).index)
  ) {
    return (metadata as HistoryState).index as number;
  }

  return null;
}

function getHistoryTraversalIntent(
  targetIndex: number | null,
  currentIndex: number | null,
): NavigationIntent | null {
  if (targetIndex === null || currentIndex === null || targetIndex === currentIndex) {
    return null;
  }

  return targetIndex < currentIndex ? "pop" : "push";
}

function writeHistoryEntryIndex(index: number) {
  const currentState = window.history.state;
  const nextState: HistoryState =
    currentState && typeof currentState === "object" && !Array.isArray(currentState)
      ? { ...(currentState as HistoryState) }
      : {};

  nextState[historyStateKey] = { index };
  window.history.replaceState(nextState, "", window.location.href);
}

function getInitialHistoryEntryIndex() {
  const currentIndex = readHistoryEntryIndex(window.history.state);
  if (currentIndex !== null) {
    return currentIndex;
  }

  writeHistoryEntryIndex(0);
  return 0;
}

type TransitionIntent = NavigationIntent;

export function getIncomingVariants(reduceMotion: boolean | null) {
  const duration = reduceMotion ? 0 : 0.2;
  const tabDuration = reduceMotion ? 0 : 0.14;

  return {
    initial: (intent: TransitionIntent) => {
      if (reduceMotion) {
        return { opacity: 1, x: 0 };
      }

      switch (intent) {
        case "tab":
          return { opacity: 0, x: 0 };
        case "push":
          return { opacity: 1, x: 48 };
        case "pop":
          return { opacity: 1, x: -48 };
        case "sheet":
        case "replace":
        default:
          return { opacity: 1, x: 0 };
      }
    },
    animate: (intent: TransitionIntent) => {
      switch (intent) {
        case "tab":
          return {
            opacity: 1,
            x: 0,
            transition: { duration: tabDuration, ease: standardEase },
          };
        case "sheet":
        case "replace":
          return {
            opacity: 1,
            x: 0,
            transition: { duration: 0 },
          };
        case "push":
        case "pop":
        default:
          return {
            opacity: 1,
            x: 0,
            transition: { duration, ease: standardEase },
          };
      }
    },
  };
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const intentRef = useRef<NavigationIntent>("push");
  const currentHistoryIndexRef = useRef<number | null>(null);
  const historyNavigationRef = useRef(false);
  const historyNavigationTargetIndexRef = useRef<number | null>(null);
  const committedRouteTargetRef = useRef<string | null>(null);
  const incomingVariants = getIncomingVariants(reduceMotion);
  const routeTarget = `${pathname}${normalizeSearch(searchParams?.toString() ?? "")}`;
  const rawRouteTarget = `${pathname}${typeof window === "undefined" ? "" : window.location.search}`;
  const {
    intent: pendingNavigationIntent,
    target: pendingNavigationTarget,
    sourceRoute: pendingNavigationSourceRoute,
    version: currentNavigationVersion,
  } = getNavigationIntentState();
  const isSameCommittedRoute = committedRouteTargetRef.current === routeTarget;
  const isStaleSameRouteIntent =
    isSameCommittedRoute &&
    pendingNavigationTarget === null &&
    pendingNavigationSourceRoute === getCurrentRouteNavigationTarget();
  const pendingNavigationRoute = pendingNavigationTarget
    ? getRouteNavigationTarget(pendingNavigationTarget)
    : null;
  const liveHistoryEntryIndex =
    typeof window === "undefined" ? null : readHistoryEntryIndex(window.history.state);
  const liveHistoryTraversalIntent =
    !isSameCommittedRoute &&
    pendingNavigationIntent === null &&
    pendingNavigationTarget === null
      ? getHistoryTraversalIntent(liveHistoryEntryIndex, currentHistoryIndexRef.current)
      : null;
  const requestedIntent =
    !isStaleSameRouteIntent &&
    pendingNavigationIntent !== null &&
    pendingNavigationTarget !== null &&
    pendingNavigationRoute !== routeTarget
      ? "push"
      : pendingNavigationIntent ?? liveHistoryTraversalIntent ?? intentRef.current;

  useEffect(() => {
    currentHistoryIndexRef.current = getInitialHistoryEntryIndex();

    function captureNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const intent = getNavigationIntent(event.target);
      if (intent === null) {
        return;
      }

      if (
        event.target instanceof Element &&
        event.target.closest("a[data-navigation-lifecycle=\"managed\"]")
      ) {
        return;
      }

      const navigationTarget = getInternalNavigationTarget(event.target);
      const currentTarget = getCurrentNavigationTarget();
      const routeNavigationTarget = navigationTarget
        ? getRouteNavigationTarget(navigationTarget)
        : null;
      if (
        navigationTarget === null ||
        routeNavigationTarget === null ||
        navigationTarget === currentTarget
      ) {
        clearPendingNavigationIntent();
        historyNavigationRef.current = false;
        historyNavigationTargetIndexRef.current = null;
        intentRef.current = "push";
        return;
      }

      // Hash-only links remain same-document anchors. They intentionally do not
      // create a route transition or a custom index; the browser owns those
      // intra-page history entries and their scroll behavior.
      if (routeNavigationTarget === getCurrentRouteNavigationTarget()) {
        clearPendingNavigationIntent();
        historyNavigationRef.current = false;
        historyNavigationTargetIndexRef.current = null;
        intentRef.current = "push";
        return;
      }

      historyNavigationRef.current = false;
      historyNavigationTargetIndexRef.current = null;
      intentRef.current = intent;
      setNavigationIntent(intent, navigationTarget);
    }

    function captureHistoryNavigation(event: PopStateEvent) {
      const targetIndex = readHistoryEntryIndex(event.state);
      const currentIndex = currentHistoryIndexRef.current;

      // A hash-only back/forward entry does not change the rendered route. Do
      // not let its pop intent leak into the next pathname/search navigation.
      if (
        committedRouteTargetRef.current !== null &&
        committedRouteTargetRef.current === getCurrentRouteNavigationTarget()
      ) {
        historyNavigationRef.current = false;
        historyNavigationTargetIndexRef.current = null;
        intentRef.current = "push";
        clearPendingNavigationIntent();
        return;
      }

      historyNavigationRef.current = true;
      historyNavigationTargetIndexRef.current = targetIndex;

      if (targetIndex !== null && currentIndex !== null) {
        intentRef.current =
          targetIndex < currentIndex
            ? "pop"
            : targetIndex > currentIndex
              ? "push"
              : "replace";
      } else {
        intentRef.current = "replace";
      }

      setNavigationIntent(intentRef.current);
    }

    // Capture before React/Link handlers so Next's own preventDefault does not
    // hide a valid client-side navigation. The target check on commit drops
    // intents from handlers that prevent navigation altogether.
    document.addEventListener("click", captureNavigation, true);
    window.addEventListener("popstate", captureHistoryNavigation, true);

    return () => {
      document.removeEventListener("click", captureNavigation, true);
      window.removeEventListener("popstate", captureHistoryNavigation, true);
      clearPendingNavigationIntent();
    };
  }, []);

  useEffect(() => {
    const {
      intent: pendingNavigationIntent,
      target: pendingNavigationTarget,
      sourceRoute: pendingNavigationSourceRoute,
    } = getNavigationIntentState();

    if (committedRouteTargetRef.current === routeTarget) {
      // If a programmatic caller requested an intent without a destination
      // but the route stayed put, consume that request before it can affect a
      // later navigation. A target-bound request is cleared at the call site
      // when it points at this same canonical route.
      if (
        pendingNavigationTarget === null &&
        pendingNavigationSourceRoute === getCurrentRouteNavigationTarget()
      ) {
        intentRef.current = "push";
        clearPendingNavigationIntent();
      }

      // A canonical-equivalent URL may still be a new browser entry. Preserve
      // the current custom index on that entry so a later pop cannot lose its
      // direction metadata.
      if (
        readHistoryEntryIndex(window.history.state) === null &&
        currentHistoryIndexRef.current !== null
      ) {
        writeHistoryEntryIndex(currentHistoryIndexRef.current);
      }
      return;
    }

    const targetIndex = readHistoryEntryIndex(window.history.state);
    const currentIndex = currentHistoryIndexRef.current;
    const historyTargetIndex = historyNavigationTargetIndexRef.current;
    const canInferHistoryTraversal =
      pendingNavigationIntent === null && pendingNavigationTarget === null;
    const liveHistoryTraversalIntent = canInferHistoryTraversal
      ? getHistoryTraversalIntent(targetIndex, currentIndex)
      : null;
    let committedIntent = pendingNavigationIntent ?? intentRef.current;
    const pendingTargetMatchesCurrentPath =
      pendingNavigationTarget === null ||
      getRouteNavigationTarget(pendingNavigationTarget) === routeTarget;

    if (pendingNavigationIntent !== null && !pendingTargetMatchesCurrentPath) {
      clearPendingNavigationIntent();
      intentRef.current = "push";
      committedIntent = "push";
    }
    const isInitialCommit = committedRouteTargetRef.current === null;
    const isHistoryNavigation =
      historyNavigationRef.current && pendingNavigationTarget === null;
    const isInferredHistoryNavigation = liveHistoryTraversalIntent !== null;

    if (isInferredHistoryNavigation && !isHistoryNavigation) {
      committedIntent = liveHistoryTraversalIntent;
      intentRef.current = committedIntent;
    }
    let committedIndex: number;

    if (isInitialCommit) {
      committedIndex = targetIndex ?? currentIndex ?? 0;
    } else if (
      (isHistoryNavigation || isInferredHistoryNavigation) &&
      (historyTargetIndex ?? targetIndex) !== null
    ) {
      // Next may update the target entry's history.state before this effect
      // runs. Prefer an index captured from popstate; otherwise use the live
      // target index observed during render so a browser back/forward cannot be
      // mistaken for a new push entry.
      committedIndex = historyTargetIndex ?? targetIndex ?? 0;
    } else if (committedIntent !== "replace") {
      // A visual "pop" link is still a regular pushState entry. Only a real
      // browser popstate may reuse the target entry's existing index.
      committedIndex = (currentIndex ?? 0) + 1;
    } else {
      committedIndex = targetIndex ?? currentIndex ?? 0;
    }

    if (targetIndex !== committedIndex) {
      writeHistoryEntryIndex(committedIndex);
    }

    currentHistoryIndexRef.current = committedIndex;
    historyNavigationRef.current = false;
    historyNavigationTargetIndexRef.current = null;
    intentRef.current = "push";
    clearPendingNavigationIntent();
    committedRouteTargetRef.current = routeTarget;
  }, [currentNavigationVersion, rawRouteTarget, routeTarget]);

  const isInitialRender = committedRouteTargetRef.current === null;

  return (
    <div className="route-stage">
      <motion.div
        key={routeTarget}
        className="route-transition"
        data-navigation-intent={requestedIntent}
        custom={requestedIntent}
        variants={incomingVariants}
        initial={isInitialRender ? false : "initial"}
        animate="animate"
      >
        {children}
      </motion.div>
    </div>
  );
}
