"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SERVICE_WORKER_PATH,
  SERVICE_WORKER_SCOPE,
} from "@/lib/pwa/config";

export type ServiceWorkerRegistrationStatus =
  | "unsupported"
  | "registering"
  | "ready"
  | "update-available"
  | "failed";

export type ServiceWorkerRegistrationState = {
  status: ServiceWorkerRegistrationStatus;
  /**
   * Requests activation of a waiting update. Returns false when no update is
   * waiting. The reload triggered by activation happens at most once; a
   * `controllerchange` that arrives without an explicit apply intent never
   * reloads on its own.
   */
  applyUpdate: () => boolean;
  /** Retries a failed registration without forcing an activation. */
  retryRegistration: () => void;
};

/**
 * Registers after hydration and reports only states the UI can act on.
 * Updates wait for explicit confirmation: forcing activation mid-session can
 * pair a new client bundle with an older active session and blocks rollback.
 *
 * Reload-once contract: an explicit apply arms a single reload, and the armed
 * intent is consumed the first time a controllerchange confirms the update
 * took over. A second controllerchange (for example, a later update or a
 * rollback) must never reload again on its own.
 */
export function useServiceWorkerRegistration(): ServiceWorkerRegistrationState {
  const [status, setStatus] = useState<ServiceWorkerRegistrationStatus>("registering");
  const [attempt, setAttempt] = useState(0);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const containerRef = useRef<ServiceWorkerContainer | null>(null);
  const shouldReloadAfterUpdate = useRef(false);
  const reloadArmedOnce = useRef(false);

  const applyUpdate = useCallback(() => {
    const waitingWorker = registrationRef.current?.waiting;
    if (!waitingWorker) return false;

    shouldReloadAfterUpdate.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    return true;
  }, []);

  const retryRegistration = useCallback(() => {
    setStatus("registering");
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    const serviceWorker = navigator.serviceWorker;
    containerRef.current = serviceWorker;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installingWorker: ServiceWorker | null = null;

    const setReadyOrUpdateAvailable = () => {
      if (cancelled) return;
      setStatus(
        registration?.waiting && serviceWorker.controller
          ? "update-available"
          : "ready",
      );
    };

    const onInstallingStateChange = () => {
      if (installingWorker?.state === "installed") {
        setReadyOrUpdateAvailable();
      }
    };

    const onUpdateFound = () => {
      installingWorker?.removeEventListener("statechange", onInstallingStateChange);
      installingWorker = registration?.installing ?? null;
      installingWorker?.addEventListener("statechange", onInstallingStateChange);
    };

    const onControllerChange = () => {
      if (shouldReloadAfterUpdate.current && !reloadArmedOnce.current) {
        reloadArmedOnce.current = true;
        shouldReloadAfterUpdate.current = false;
        window.location.reload();
      }
    };

    serviceWorker.addEventListener("controllerchange", onControllerChange);
    void serviceWorker
      .register(SERVICE_WORKER_PATH, { scope: SERVICE_WORKER_SCOPE })
      .then((registered) => {
        if (cancelled) return;
        registration = registered;
        registrationRef.current = registered;
        registered.addEventListener("updatefound", onUpdateFound);
        onUpdateFound();
        setReadyOrUpdateAvailable();
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
      registrationRef.current = null;
      containerRef.current = null;
      registration?.removeEventListener("updatefound", onUpdateFound);
      installingWorker?.removeEventListener("statechange", onInstallingStateChange);
      serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
    // `attempt` drives an explicit retry: re-register on a new attempt.
  }, [attempt]);

  return { status, applyUpdate, retryRegistration };
}
