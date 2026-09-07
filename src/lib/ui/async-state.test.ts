import { describe, expect, it } from "vitest";

import {
  entryMatchesSession,
  identityKey,
  isUnavailable,
  sameSession,
  type UiIdentity,
} from "./async-state";

describe("async-state identity helpers", () => {
  const identity: UiIdentity = {
    sessionEpoch: 4,
    subject: "user-1",
    routeKey: "meetup:meetup-1",
    queryKey: '{"activity":"WALK"}',
  };

  it("builds a stable local identity key without leaking ids to telemetry", () => {
    expect(identityKey(identity)).toBe("4:user-1:meetup:meetup-1");
    expect(identityKey({ sessionEpoch: 4, subject: null, routeKey: "home" })).toBe(
      "4:anonymous:home",
    );
  });

  it("treats the same subject across a logout as a different session", () => {
    const before = { sessionEpoch: 4, subject: "user-1" };
    const afterRelogin = { sessionEpoch: 5, subject: "user-1" };
    expect(sameSession(before, before)).toBe(true);
    expect(sameSession(before, afterRelogin)).toBe(false);
  });

  it("marks stored entries stale when epoch or subject changes", () => {
    const stored = { sessionEpoch: 4, subject: "user-1" };
    expect(entryMatchesSession(stored, { sessionEpoch: 4, subject: "user-1" })).toBe(true);
    expect(entryMatchesSession(stored, { sessionEpoch: 5, subject: "user-1" })).toBe(false);
    expect(entryMatchesSession(stored, { sessionEpoch: 4, subject: "user-2" })).toBe(false);
    expect(entryMatchesSession(null, { sessionEpoch: 4, subject: "user-1" })).toBe(false);
    expect(entryMatchesSession(undefined, { sessionEpoch: 4, subject: "user-1" })).toBe(false);
  });

  it("keeps unavailable distinct from a normal empty result", () => {
    const unavailable = { kind: "unavailable", reason: "contract-missing" } as const;
    const emptyData = { kind: "data", value: [] } as const;
    expect(isUnavailable(unavailable)).toBe(true);
    expect(isUnavailable(emptyData)).toBe(false);
    if (isUnavailable(unavailable)) {
      expect(unavailable.reason).toBe("contract-missing");
    }
  });
});
