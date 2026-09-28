"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Same-origin app path only: rejects absolute and protocol-relative URLs. */
export function safeNavigationPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Routes notification clicks inside the open app. The service worker posts a
 * NAVIGATE message instead of reloading the window, because a document
 * navigation would discard the in-memory session.
 */
export function ServiceWorkerNavigation() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;

    function onMessage(event: MessageEvent) {
      const data: unknown = event.data;
      if (!data || typeof data !== "object" || (data as { type?: unknown }).type !== "NAVIGATE") return;
      const path = safeNavigationPath((data as { url?: unknown }).url);
      if (!path) return;
      router.push(path);
      // Tells the worker the route was handled so it does not reload the page.
      event.ports[0]?.postMessage({ type: "NAVIGATED" });
    }

    container.addEventListener("message", onMessage);
    // addEventListener does not start the client message queue on its own.
    container.startMessages?.();
    return () => container.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
