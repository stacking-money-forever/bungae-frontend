import { describe, expect, it } from "vitest";

import {
  createTelemetryController,
  type TelemetryEvent,
  type TelemetrySink,
} from "./telemetry";

function collectSink(): { sink: TelemetrySink; events: TelemetryEvent[] } {
  const events: TelemetryEvent[] = [];
  return {
    events,
    sink: (event) => {
      events.push(event);
    },
  };
}

describe("createTelemetryController", () => {
  it("is disabled by default and never fabricates a recorded claim", () => {
    const controller = createTelemetryController(undefined);
    expect(
      controller.report({
        kind: "render",
        routeTemplate: "/",
        boundary: "root",
      }),
    ).toBe("disabled");
  });

  it("records only sanitized fields with a test-only sink", () => {
    const { sink, events } = collectSink();
    const controller = createTelemetryController(sink, () => 1700000000000);

    const result = controller.report({
      kind: "client-unhandled",
      routeTemplate: "/meetups/[id]",
      boundary: "meetup",
      code: "TypeError",
    });

    expect(result).toBe("recorded-local");
    expect(events).toEqual([
      {
        kind: "client-unhandled",
        routeTemplate: "/meetups/[id]",
        boundary: "meetup",
        code: "TypeError",
        reportedAt: 1700000000000,
      },
    ]);
  });

  it("never lets a throwing sink crash the caller", () => {
    const controller = createTelemetryController(() => {
      throw new Error("observer broken");
    });
    expect(
      controller.report({
        kind: "render",
        routeTemplate: "/",
        boundary: "root",
      }),
    ).toBe("disabled");
  });
});
