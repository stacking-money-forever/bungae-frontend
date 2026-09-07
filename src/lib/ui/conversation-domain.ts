/**
 * Conversation presentation contracts shared by the group meetup chat and the
 * (contract-unavailable) 1:1 connection chat. Transport-agnostic by design:
 * this module never reads the session store, never issues requests, and never
 * invents server state. Views that lack an adapter must show an explicit
 * unavailable state instead of calling any send/realtime port.
 */

import type { Message } from "@/lib/api/types";

export type ConversationRef =
  | { kind: "meetup"; id: string }
  | { kind: "connection"; id: string };

/** Capability gate. Only `available` ports may be called by a view. */
export type ConversationCapability =
  | "history"
  | "send"
  | "realtime"
  | "reportMessage"
  | "blockCounterpart";

export type CapabilityStatus =
  | { state: "available" }
  | { state: "unavailable"; reason: "contract-missing" | "not-connected" | "capability-unsupported" };

export type CapabilityMap = Record<ConversationCapability, CapabilityStatus>;

export type ViewIdentity = {
  /** Session-scoped key (`epoch:subject`) so the same subject re-login is a new session. */
  sessionKey: string;
  /** Conversation-scoped key; distinct from telemetry (never sent anywhere). */
  routeKey: string;
};

export type HistoryLoad =
  | { status: "loading" }
  | { status: "ready"; items: Message[]; nextCursor?: string }
  | { status: "error"; message: string };

/** Test-only event lane; no production realtime transport exists in this build. */
export type ConversationEvent =
  | { type: "connection-state"; state: "live" | "interrupted" | "reconnecting" | "closed" }
  | { type: "message"; message: Message; authoritativeOrder: boolean }
  | { type: "resync-required" }
  | { type: "access-revoked"; sessionKey: string };

export function mergeById(existing: Message[], incoming: Message[]): Message[] {
  const seen = new Set<string>();
  const result: Message[] = [];
  for (const message of [...existing, ...incoming]) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    result.push(message);
  }
  return result;
}
