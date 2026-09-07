import { describe, expect, it } from "vitest";

import type { Message } from "@/lib/api/types";
import {
  applyViewTransition,
  canSend,
  entryMatches,
  initialState,
  type ConversationAction,
} from "./conversation-state";

const message = (id: string, text = `${id}-text`): Message => ({
  id,
  sender: { userId: "u", displayName: "민지" },
  text,
  createdAt: "2026-09-07T10:00:00.000Z",
});

const identity = { sessionKey: "2:user-a", routeKey: "meetup:demo" };

function fold(actions: ConversationAction[]) {
  return actions.reduce((state, action) => applyViewTransition(state, action), initialState());
}

describe("conversation-state access and capability presentation", () => {
  it("starts checking and cannot send until allowed", () => {
    const state = initialState();
    expect(state.access).toBe("checking");
    expect(state.sendCapable).toBe(false);
    expect(canSend(state, { subject: "user-a", online: true, draft: "안녕", maxLength: 2000 })).toBe(false);
  });

  it("distinguishes unauthorized from unavailable from error without inventing data", () => {
    const unauthorized = applyViewTransition(initialState(), { type: "access-unauthorized" });
    expect(unauthorized.access).toBe("unauthorized");
    expect(unauthorized.history).toMatchObject({ status: "error", message: "이 대화를 볼 수 있는 권한이 없어요." });
    expect(canSend(unauthorized, { subject: "user-a", online: true, draft: "안녕", maxLength: 2000 })).toBe(false);

    const unavailable = applyViewTransition(initialState(), { type: "access-unavailable" });
    expect(unavailable.access).toBe("unavailable");
    expect(unavailable.sendCapable).toBe(false);

    const errored = applyViewTransition(initialState(), { type: "access-error" });
    expect(errored.access).toBe("error");
    expect(errored.history).toMatchObject({ status: "error" });
  });

  it("allows send only with allowed access, ready history, send capability, draft, and online link", () => {
    const base = fold([
      { type: "access-allowed" },
      { type: "history-ready", page: { items: [message("m1")] }, append: false, dedupe: true },
    ]);
    expect(base.sendCapable).toBe(true);
    expect(canSend(base, { subject: "user-a", online: true, draft: "보낼 말", maxLength: 2000 })).toBe(true);
    expect(canSend(base, { subject: null, online: true, draft: "보낼 말", maxLength: 2000 })).toBe(false);
    expect(canSend(base, { subject: "user-a", online: false, draft: "보낼 말", maxLength: 2000 })).toBe(false);
    expect(canSend(base, { subject: "user-a", online: true, draft: "  ", maxLength: 2000 })).toBe(false);
    expect(canSend(base, { subject: "user-a", online: true, draft: "x".repeat(2001), maxLength: 2000 })).toBe(false);
  });

  it("blocks send while a submission is in flight", () => {
    const base = fold([
      { type: "access-allowed" },
      { type: "history-ready", page: { items: [message("m1")] }, append: false, dedupe: true },
      { type: "send-submitting" },
    ]);
    expect(canSend(base, { subject: "user-a", online: true, draft: "보낼 말", maxLength: 2000 })).toBe(false);
  });
});

describe("conversation-state history phases", () => {
  it("replaces on initial ready and appends with dedupe on append", () => {
    const initial = fold([
      { type: "access-allowed" },
      { type: "history-ready", page: { items: [message("m1"), message("m2")], nextCursor: "c1" }, append: false, dedupe: true },
    ]);
    expect(initial.history).toMatchObject({ status: "ready", nextCursor: "c1" });
    const appended = applyViewTransition(initial, {
      type: "history-ready",
      page: { items: [message("m2"), message("m3")] },
      append: true,
      dedupe: true,
    });
    expect(appended.history).toMatchObject({ status: "ready" });
    if (appended.history.status === "ready") {
      expect(appended.history.items.map((item) => item.id)).toEqual(["m1", "m2", "m3"]);
    }
  });

  it("keeps committed items visible on append failure and exposes a retryable message", () => {
    const initial = fold([
      { type: "access-allowed" },
      { type: "history-ready", page: { items: [message("m1")], nextCursor: "c1" }, append: false, dedupe: true },
      { type: "append-error", message: "이전 메시지를 불러오지 못했어요." },
    ]);
    expect(initial.appendError).toBe("이전 메시지를 불러오지 못했어요.");
    if (initial.history.status === "ready") {
      expect(initial.history.items.map((item) => item.id)).toEqual(["m1"]);
    }
  });

  it("distinguishes an empty ready conversation from a loading or error phase", () => {
    const empty = fold([{ type: "access-allowed" }, { type: "history-ready", page: { items: [] }, append: false, dedupe: true }]);
    expect(empty.history).toMatchObject({ status: "ready", items: [] });
    const error = applyViewTransition(empty, { type: "history-error", message: "메시지를 불러오지 못했어요." });
    expect(error.history).toMatchObject({ status: "error" });
  });
});

describe("conversation-state unread and new-message presentation", () => {
  it("counts new arrivals while the reader is above the newest anchor", () => {
    let state = fold([{ type: "access-allowed" }, { type: "history-ready", page: { items: [message("m1")] }, append: false, dedupe: true }]);
    state = applyViewTransition(state, { type: "unread-add", count: 2 });
    expect(state.unreadCount).toBe(2);
    state = applyViewTransition(state, { type: "unread-increment" });
    expect(state.unreadCount).toBe(3);
    state = applyViewTransition(state, { type: "unread-reset" });
    expect(state.unreadCount).toBe(0);
  });

  it("dedupes an authoritative late message that is already present", () => {
    let state = fold([{ type: "access-allowed" }, { type: "history-ready", page: { items: [message("m1")] }, append: false, dedupe: true }]);
    state = applyViewTransition(state, { type: "prepend-message", message: message("m1"), authoritativeOrder: true });
    if (state.history.status === "ready") {
      expect(state.history.items).toHaveLength(1);
    }
    state = applyViewTransition(state, { type: "prepend-message", message: message("m2"), authoritativeOrder: true });
    if (state.history.status === "ready") {
      expect(state.history.items.map((item) => item.id)).toEqual(["m1", "m2"]);
    }
  });

  it("never claims ordering when the adapter lacks an authoritative order", () => {
    const state = fold([
      { type: "access-allowed" },
      { type: "history-ready", page: { items: [message("m1")] }, append: false, dedupe: true },
      { type: "prepend-message", message: message("m2"), authoritativeOrder: false },
    ]);
    expect(state.hasAuthoritativeOrder).toBe(false);
    if (state.history.status === "ready") {
      expect(state.history.items.map((item) => item.id)).toEqual(["m1"]);
    }
  });
});

describe("conversation-state revocation and epoch reset", () => {
  it("clears private content on access revocation", () => {
    const full = fold([
      { type: "access-allowed" },
      { type: "history-ready", page: { items: [message("private")] }, append: false, dedupe: true },
      { type: "unread-add", count: 1 },
    ]);
    const reset = applyViewTransition(full, { type: "reset", sessionKey: identity.sessionKey });
    expect(reset.access).toBe("checking");
    expect(reset.history).toMatchObject({ status: "loading" });
    expect(reset.unreadCount).toBe(0);
    expect(reset.sessionKey).toBe(identity.sessionKey);
  });

  it("drops any transition from a stale session while keeping the fresh entry", () => {
    const fresh = fold([
      { type: "reset", sessionKey: identity.sessionKey },
      { type: "access-allowed" },
      { type: "history-ready", page: { items: [message("fresh")] }, append: false, dedupe: true },
    ]);
    // A stale completion must not wipe the current session's content; the
    // entry match is the consumer's guard, and reset only carries the current
    // session key forward.
    expect(entryMatches(fresh, identity)).toBe(true);
    expect(entryMatches({ ...fresh, sessionKey: "1:user-a" }, identity)).toBe(false);
  });
});
