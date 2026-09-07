"use client";

import { useEffect, useRef, useState } from "react";

import { toRouteTemplate } from "@/lib/ui/route-templates";
import {
  createTelemetryController,
  type TelemetryReportInput,
  type TelemetrySink,
} from "@/lib/ui/telemetry";

/**
 * Subscribes to window `error` and `unhandledrejection` so unexpected client
 * failures reach the privacy-safe telemetry sink. Known failures that
 * handlers already reflect as typed state are not re-reported here.
 *
 * This observer never calls `preventDefault()` (browser default reporting
 * stays on), never suppresses console output, and never resets or fabricates
 * a screen result for an unknown async failure.
 */
export function useClientErrorObserver(report: (input: TelemetryReportInput) => void) {
  const pathnameRef = useRef("/");
  const reportRef = useRef(report);
  reportRef.current = report;

  useEffect(() => {
    const pathname = window.location.pathname;
    pathnameRef.current = pathname;

    function handleError(event: ErrorEvent) {
      reportRef.current({
        kind: "client-unhandled",
        routeTemplate: toRouteTemplate(pathnameRef.current),
        boundary: "root",
        code: event.error instanceof Error ? event.error.name : undefined,
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const value = event.reason;
      reportRef.current({
        kind: "client-unhandled",
        routeTemplate: toRouteTemplate(pathnameRef.current),
        boundary: "root",
        code: value instanceof Error ? value.name : undefined,
      });
    }

    function handleResource(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      reportRef.current({
        kind: "resource",
        routeTemplate: toRouteTemplate(pathnameRef.current),
        boundary: "root",
        code: target.tagName,
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleResource, true);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleResource, true);
    };
  }, []);
}

export type ClientErrorObserverProps = {
  /** Test-only memory sink. Production leaves this undefined (disabled). */
  sink?: TelemetrySink;
};

/**
 * Null-rendering client island mounted once from the root layout. It owns
 * unexpected-failure observation for the whole session.
 */
export function ClientErrorObserver({ sink }: ClientErrorObserverProps) {
  const [controller] = useState(() => createTelemetryController(sink));
  useClientErrorObserver(controller.report);
  return null;
}
