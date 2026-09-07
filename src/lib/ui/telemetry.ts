/**
 * Privacy-safe, disabled-by-default telemetry abstraction. Production never
 * records or transmits anything: the default sink is `disabled`. Test-only
 * memory sinks observe redaction, routing, and deduplication only.
 *
 * Contract (from the frontend no-API plan §4.3):
 *   report({ kind, routeTemplate, boundary, code?, digest? })
 *     -> "recorded-local" | "disabled"
 *
 * No vendor SDK, no network, no persistent log, no session replay. Payloads
 * must never carry ids, phone numbers, chat/form content, tokens, queries,
 * full URLs, stacks, or raw Error objects. A throwing sink must never crash
 * the app again.
 */

export type TelemetryEventKind = "render" | "client-unhandled" | "resource";

export interface TelemetryReportInput {
  kind: TelemetryEventKind;
  /** Route template like `/meetups/[meetupId]`; never a raw id. */
  routeTemplate: string;
  boundary: "root" | "global" | "meetups" | "meetup" | "profile" | "connections";
  code?: string;
  digest?: string;
}

export interface TelemetryEvent extends TelemetryReportInput {
  reportedAt: number;
}

export type TelemetryResult = "recorded-local" | "disabled";

export type TelemetrySink = (event: TelemetryEvent) => void;

export interface TelemetryController {
  /** Reports are recorded only when a sink is installed (tests only). */
  report(input: TelemetryReportInput): TelemetryResult;
}

export function createTelemetryController(
  sink: TelemetrySink | undefined,
  now: () => number = Date.now,
): TelemetryController {
  return {
    report(input: TelemetryReportInput): TelemetryResult {
      if (sink === undefined) {
        return "disabled";
      }
      try {
        sink({ ...input, reportedAt: now() });
        return "recorded-local";
      } catch {
        // A broken observer must never take the app down again.
        return "disabled";
      }
    },
  };
}
