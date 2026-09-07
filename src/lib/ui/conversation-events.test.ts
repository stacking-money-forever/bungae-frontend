import { describe, expect, it } from "vitest";

import type { Message } from "@/lib/api/types";
import {
  applyViewTransition,
  eventToAction,
  initialState,
} from "./conversation-state";

const message = (id: string): Message => ({
  id,
  sender: { userId: "u", displayName: "민지" },
  text: "텍스트",
  createdAt: "2026-09-07T10:00:00.000Z",
});

describe("conversation-state realtime event presentation (test-only lane)", () => {
  it("maps a live lane to no transport claim and restores send after a resync read", () => {
    let state = initialState();
    state = applyViewTransition(state, { type: "reset", sessionKey: "2:user-a" });
    state = applyViewTransition(state, { type: "access-allowed" });
    state = applyViewTransition(state, { type: "history-ready", page: { items: [message("m1")] }, append: false, dedupe: true });
    state = applyViewTransition(state, eventToAction({ type: "connection-state", state: "interrupted" }));
    expect(state.interrupted).toBe(true);
    expect(state.resyncRequired).toBe(true);
    expect(state.sendCapable).toBe(false);
    state = applyViewTransition(state, eventToAction({ type: "connection-state", state: "reconnecting" }));
    expect(state.interrupted).toBe(false);
    expect(state.resyncRequired).toBe(true);
    // A fresh read is the only recovery from resync; there is no replay
    // protocol and no auto-resend.
    state = applyViewTransition(state, { type: "history-loading" });
    state = applyViewTransition(state, { type: "history-ready", page: { items: [message("m1"), message("m2")] }, append: false, dedupe: true });
    expect(state.resyncRequired).toBe(false);
  });

  it("renders an authoritative incoming message without counting a duplicate", () => {
    let state = initialState();
    state = applyViewTransition(state, { type: "reset", sessionKey: "2:user-a" });
    state = applyViewTransition(state, { type: "access-allowed" });
    state = applyViewTransition(state, { type: "history-ready", page: { items: [message("m1")] }, append: false, dedupe: true });
    state = applyViewTransition(state, eventToAction({ type: "message", message: message("m2"), authoritativeOrder: true }));
    if (state.history.status === "ready") {
      expect(state.history.items.map((item) => item.id)).toEqual(["m1", "m2"]);
    }
    state = applyViewTransition(state, eventToAction({ type: "message", message: message("m2"), authoritativeOrder: true }));
    if (state.history.status === "ready") {
      expect(state.history.items).toHaveLength(2);
    }
  });

  it("keeps a non-authoritative arrival from claiming ordering", () => {
    let state = initialState();
    state = applyViewTransition(state, { type: "reset", sessionKey: "2:user-a" });
    state = applyViewTransition(state, { type: "access-allowed" });
    state = applyViewTransition(state, { type: "history-ready", page: { items: [message("m1")] }, append: false, dedupe: true });
    state = applyViewTransition(state, eventToAction({ type: "message", message: message("m2"), authoritativeOrder: false }));
    if (state.history.status === "ready") {
      expect(state.history.items.map((item) => item.id)).toEqual(["m1"]);
    }
    expect(state.hasAuthoritativeOrder).toBe(false);
  });

  it("wipes private content on access revocation and requires a fresh read", () => {
    let state = initialState();
    state = applyViewTransition(state, { type: "reset", sessionKey: "2:user-a" });
    state = applyViewTransition(state, { type: "access-allowed" });
    state = applyViewTransition(state, { type: "history-ready", page: { items: [message("private")] }, append: false, dedupe: true });
    state = applyViewTransition(state, { type: "unread-add", count: 2 });
    state = applyViewTransition(state, eventToAction({ type: "access-revoked", sessionKey: "3:user-a" }));
    expect(state.access).toBe("checking");
    expect(state.history).toMatchObject({ status: "loading" });
    expect(state.unreadCount).toBe(0);
    expect(state.sessionKey).toBe("3:user-a");
    expect(state.sendCapable).toBe(false);
  });
});
