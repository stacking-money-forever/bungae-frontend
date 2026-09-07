import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useServiceWorkerRegistration } from "@/lib/pwa/use-service-worker-registration";

const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

function restoreServiceWorker() {
  if (serviceWorkerDescriptor) {
    Object.defineProperty(navigator, "serviceWorker", serviceWorkerDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
}

function installServiceWorkerStub(options: {
  registration?: ServiceWorkerRegistration;
  registerError?: Error;
  controller?: ServiceWorker | null;
} = {}) {
  const container = {
    controller: options.controller ?? null,
    register: options.registerError
      ? vi.fn().mockRejectedValue(options.registerError)
      : vi.fn().mockResolvedValue(options.registration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as ServiceWorkerContainer;

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });
  return container;
}

function makeRegistration(waiting: ServiceWorker | null = null) {
  return {
    waiting,
    installing: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as ServiceWorkerRegistration;
}

/** Intercept reload: jsdom's Location#reload is not configurable, but
 *  window.location itself is, so swap in a copy with a stubbed reload. */
function stubLocationReload(): ReturnType<typeof vi.fn> {
  const originalLocation = window.location;
  const reload = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload },
  });
  return reload;
}

function restoreLocation(originalLocation: Location) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
}

/** Dispatch a captured controllerchange listener and return its handlers. */
function dispatchControllerChange(container: ServiceWorkerContainer) {
  const addCalls = vi.mocked(container.addEventListener).mock.calls;
  const handler = addCalls.find(([type]) => type === "controllerchange")?.[1];
  if (typeof handler !== "function") throw new Error("controllerchange listener missing");
  (handler as EventListener).call(container, new Event("controllerchange"));
}

describe("useServiceWorkerRegistration", () => {
  afterEach(() => {
    restoreServiceWorker();
    vi.restoreAllMocks();
  });

  it("honestly reports unsupported browsers without attempting registration", async () => {
    restoreServiceWorker();
    const { result } = renderHook(() => useServiceWorkerRegistration());

    await waitFor(() => {
      expect(result.current.status).toBe("unsupported");
    });
  });

  it("reports a registration failure", async () => {
    installServiceWorkerStub({ registerError: new Error("insecure context") });
    const { result } = renderHook(() => useServiceWorkerRegistration());

    await waitFor(() => {
      expect(result.current.status).toBe("failed");
    });
  });

  it("waits for an explicit action before activating an available update", async () => {
    const waiting = { postMessage: vi.fn() } as unknown as ServiceWorker;
    const registration = makeRegistration(waiting);
    installServiceWorkerStub({ registration, controller: {} as ServiceWorker });
    const { result } = renderHook(() => useServiceWorkerRegistration());

    await waitFor(() => {
      expect(result.current.status).toBe("update-available");
    });
    expect(waiting.postMessage).not.toHaveBeenCalled();

    expect(result.current.applyUpdate()).toBe(true);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("reloads at most once after an explicit update, ignoring later controller changes", async () => {
    const originalLocation = window.location;
    const reload = stubLocationReload();
    try {
      const waiting = { postMessage: vi.fn() } as unknown as ServiceWorker;
      const registration = makeRegistration(waiting);
      const container = installServiceWorkerStub({
        registration,
        controller: {} as ServiceWorker,
      });
      const { result } = renderHook(() => useServiceWorkerRegistration());

      await waitFor(() => {
        expect(result.current.status).toBe("update-available");
      });
      expect(result.current.applyUpdate()).toBe(true);

      // First controllerchange confirms the update took over: one reload.
      dispatchControllerChange(container);
      expect(reload).toHaveBeenCalledTimes(1);

      // A second change (later update / rollback) must not reload on its own.
      dispatchControllerChange(container);
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      restoreLocation(originalLocation);
    }
  });

  it("never reloads from a controller change that was not armed by applyUpdate", async () => {
    const originalLocation = window.location;
    const reload = stubLocationReload();
    try {
      const registration = makeRegistration();
      const container = installServiceWorkerStub({ registration });
      renderHook(() => useServiceWorkerRegistration());

      await waitFor(() => {
        expect(vi.mocked(container.addEventListener).mock.calls.length).toBeGreaterThan(0);
      });
      dispatchControllerChange(container);
      expect(reload).not.toHaveBeenCalled();
    } finally {
      restoreLocation(originalLocation);
    }
  });

  it("retries a failed registration on an explicit request", async () => {
    const container = installServiceWorkerStub({ registerError: new Error("insecure context") });
    const { result } = renderHook(() => useServiceWorkerRegistration());

    await waitFor(() => {
      expect(result.current.status).toBe("failed");
    });

    const successRegistration = makeRegistration();
    vi.mocked(container.register).mockResolvedValue(successRegistration);
    act(() => result.current.retryRegistration());

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(vi.mocked(container.register).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
