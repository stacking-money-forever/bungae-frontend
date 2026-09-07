/**
 * Frontend-only view contracts shared by recovery, loading, and identity
 * handling. This module must stay transport-agnostic: it never reads the
 * session store, never issues requests, and never invents server state.
 */

export type UnavailableReason =
  | "not-connected"
  | "contract-missing"
  | "capability-unsupported";

export type ReadResult<T> =
  | { kind: "data"; value: T }
  | { kind: "unavailable"; reason: UnavailableReason }
  | { kind: "unauthorized"; reason: "sign-in" | "forbidden" }
  | { kind: "not-found" }
  | { kind: "error"; code: string; retryable: boolean };

export interface SessionIdentity {
  /**
   * Monotonic session generation. Changes on login, logout, and account
   * switch so that the same subject logged in twice is distinguishable.
   * Owned by the UI auth provider; the session store transport is untouched.
   */
  sessionEpoch: number;
  /** Authenticated user id, or null for an anonymous session. */
  subject: string | null;
}

export interface UiIdentity extends SessionIdentity {
  /** Route/entity scope, e.g. `meetup:<id>`. Never sent to telemetry. */
  routeKey: string;
  /** Canonical query identity when the surface is query-driven. */
  queryKey?: string;
}

/** Stable, privacy-safe local key for a view identity. Not for telemetry. */
export function identityKey(
  identity: Pick<UiIdentity, "subject" | "sessionEpoch" | "routeKey">,
): string {
  return `${identity.sessionEpoch}:${identity.subject ?? "anonymous"}:${identity.routeKey}`;
}

export function sameSession(
  left: Pick<UiIdentity, "subject" | "sessionEpoch">,
  right: Pick<UiIdentity, "subject" | "sessionEpoch">,
): boolean {
  return left.sessionEpoch === right.sessionEpoch && left.subject === right.subject;
}

/** Render-time staleness check for a stored view state entry. */
export function entryMatchesSession(
  entry: SessionIdentity | null | undefined,
  current: SessionIdentity,
): boolean {
  return (
    entry !== null &&
    entry !== undefined &&
    entry.sessionEpoch === current.sessionEpoch &&
    entry.subject === current.subject
  );
}

/** Narrowing guard: an empty server page is `data`, never `unavailable`. */
export function isUnavailable<T>(
  result: ReadResult<T>,
): result is Extract<ReadResult<T>, { kind: "unavailable" }> {
  return result.kind === "unavailable";
}
