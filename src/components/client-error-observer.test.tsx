import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClientErrorObserver } from "./client-error-observer";
import type { TelemetryEvent } from "@/lib/ui/telemetry";

function collectSink() {
  const events: TelemetryEvent[] = [];
  return {
    events,
    sink: (event: TelemetryEvent) => {
      events.push(event);
    },
  };
}

describe("ClientErrorObserver", () => {
  let sink: ReturnType<typeof collectSink>;
  let errors: Array<{ type: string; listener: EventListenerOrEventListenerObject | null }>;

  beforeEach(() => {
    sink = collectSink();
    errors = [];
    const originalAdd = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation(((type: string, listener: EventListenerOrEventListenerObject | null) => {
      if (type === "error" || type === "unhandledrejection") {
        errors.push({ type, listener });
      }
      return originalAdd(type, listener as EventListener, undefined as unknown as AddEventListenerOptions);
    }) as typeof window.addEventListener);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports unhandled rejections with sanitized template routes only", async () => {
    render(<ClientErrorObserver sink={sink.sink} />);

    const rejection = errors.find((entry) => entry.type === "unhandledrejection");
    expect(rejection).toBeDefined();
    await act(async () => {
      const event = new PromiseRejectionEvent("unhandledrejection", {
        reason: new TypeError("boom"),
        promise: Promise.reject(new TypeError("boom")).catch(() => undefined),
      });
      (rejection?.listener as EventListener)(event);
    });

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({
      kind: "client-unhandled",
      boundary: "root",
      code: "TypeError",
    });
    expect(sink.events[0].routeTemplate).toBe("/");
  });

  it("keeps window error payloads out of the recorded event", async () => {
    render(<ClientErrorObserver sink={sink.sink} />);

    const errorListener = errors.find((entry) => entry.type === "error");
    await act(async () => {
      const event = new ErrorEvent("error", {
        message: "secret detail",
        filename: "https://example.com/private/chat.js",
        error: new Error("secret detail"),
      });
      (errorListener?.listener as EventListener)(event);
    });

    expect(sink.events).toHaveLength(1);
    const recorded = sink.events[0];
    expect(recorded).toMatchObject({ kind: "client-unhandled", boundary: "root", code: "Error" });
    expect(JSON.stringify(recorded)).not.toContain("secret detail");
    expect(JSON.stringify(recorded)).not.toContain("private/chat");
  });

  it("reports failed resource loads without crashing", async () => {
    render(<ClientErrorObserver sink={sink.sink} />);

    const resourceListener = errors.filter((entry) => entry.type === "error").at(-1)?.listener;
    expect(resourceListener).toBeDefined();
    await act(async () => {
      const img = document.createElement("img");
      const event = new Event("error");
      Object.defineProperty(event, "target", { value: img });
      (resourceListener as EventListener)(event);
    });

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({ kind: "resource", code: "IMG" });
  });
});
