import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

declare global {
  interface Window {
    __setReducedMotionPreference: (matches: boolean) => void;
  }
}

let reducedMotionPreference = false;
const mediaQueryLists = new Set<MediaQueryList>();

function isReducedMotionQuery(query: string) {
  return query.includes("prefers-reduced-motion");
}

function createMediaQueryList(query: string) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    media: query,
    onchange: null,
    get matches() {
      return isReducedMotionQuery(query) && reducedMotionPreference;
    },
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
      if (type === "change" && listener) {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
      if (type === "change" && listener) {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    addListener: (listener: ((event: MediaQueryListEvent) => void) | null) => {
      if (listener) {
        listeners.add(listener);
      }
    },
    removeListener: (listener: ((event: MediaQueryListEvent) => void) | null) => {
      if (listener) {
        listeners.delete(listener);
      }
    },
    dispatchEvent: (event: Event) => {
      const mediaEvent = event as MediaQueryListEvent;
      listeners.forEach((listener) => listener(mediaEvent));
      if (typeof mediaQueryList.onchange === "function") {
        mediaQueryList.onchange(mediaEvent);
      }
      return true;
    },
  } as unknown as MediaQueryList;

  mediaQueryLists.add(mediaQueryList);
  return mediaQueryList;
}

beforeAll(() => {
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => createMediaQueryList(query)),
  });

  Object.defineProperty(window, "__setReducedMotionPreference", {
    configurable: true,
    value: (matches: boolean) => {
      reducedMotionPreference = matches;
      const changeEvent = new Event("change");
      mediaQueryLists.forEach((mediaQueryList) => {
        mediaQueryList.dispatchEvent(changeEvent);
      });
    },
  });
});

afterEach(cleanup);
