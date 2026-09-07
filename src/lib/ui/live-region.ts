/**
 * Shared live-region helper. The app announces new critical errors with
 * `role="alert"` and loading/completion with polite `role="status"`. A helper
 * module keeps these contracts testable without rendering DOM here.
 */

export type LiveRegionKind = "polite" | "assertive";

export interface LiveRegionCopy {
  kind: LiveRegionKind;
  /** Screen-reader announcement; must not duplicate raw error payloads. */
  label: string;
  /** Stable announcement key so the same message is not re-read verbatim. */
  announcementKey: string;
}
