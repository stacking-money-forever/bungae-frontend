/**
 * Pure conversation presentation state machine for group chat and
 * (contract-unavailable) 1:1 chat. Owns access checking, history phases,
 * append failures, unread/new-message counting, capability absence,
 * revocation/session-epoch resets, and send lifecycle without transport:
 * messages and send outcomes arrive only through typed test adapters.
 */

import type { Message, MessagePage } from "@/lib/api/types";
import type { ConversationEvent, ViewIdentity } from "@/lib/ui/conversation-domain";

export type ConversationViewState = {
  /** Null until the first access check has a definite result. */
  access: "checking" | "allowed" | "unauthorized" | "unavailable" | "error";
  history: HistoryPhase;
  /** Explicit append (older page) failure; the committed list stays visible. */
  appendError: string | null;
  /** New-message count while the reader is above the latest anchor. */
  unreadCount: number;
  sendCapable: boolean;
  /** Authoritative ordering when an adapter supplies it; else false. */
  hasAuthoritativeOrder: boolean;
  /** A realtime lane observed interruption/reconnecting. */
  interrupted: boolean;
  /** A realtime lane demanded a fresh history read. */
  resyncRequired: boolean;
  /** Same-subject re-login or revoked access wipes all private content. */
  sessionKey: string | null;
  send: SendPhase;
};

export type HistoryPhase =
  | { status: "loading" }
  | { status: "ready"; items: Message[]; nextCursor?: string }
  | { status: "error"; message: string };

export type SendPhase =
  | { status: "none" }
  | { status: "submitting" }
  | { status: "failed"; message: string }
  | { status: "outcome-unknown" };

export type ConversationAction =
  | { type: "access-allowed" }
  | { type: "access-unauthorized" }
  | { type: "access-unavailable" }
  | { type: "access-error" }
  | { type: "history-loading" }
  | { type: "history-ready"; page: MessagePage; append: boolean; dedupe: boolean }
  | { type: "history-error"; message: string }
  | { type: "append-error"; message: string }
  | { type: "send-submitting" }
  | { type: "send-acknowledged"; message: Message }
  | { type: "send-failed"; message: string }
  | { type: "send-outcome-unknown" }
  | { type: "prepend-message"; message: Message; authoritativeOrder: boolean }
  | { type: "unread-increment" }
  | { type: "unread-add"; count: number }
  | { type: "unread-reset" }
  | { type: "realtime-interrupted" }
  | { type: "realtime-restored" }
  | { type: "resync-required" }
  | { type: "reset"; sessionKey: string };

export function initialState(): ConversationViewState {
  return {
    access: "checking",
    history: { status: "loading" },
    appendError: null,
    unreadCount: 0,
    sendCapable: false,
    hasAuthoritativeOrder: false,
    interrupted: false,
    resyncRequired: false,
    sessionKey: null,
    send: { status: "none" },
  };
}

export function entryMatches(
  entry: Pick<ConversationViewState, "sessionKey"> | null,
  identity: ViewIdentity,
): boolean {
  return entry !== null && entry.sessionKey === identity.sessionKey;
}

export function canSend(
  state: ConversationViewState,
  input: { subject: string | null; online: boolean; draft: string; maxLength: number },
): boolean {
  return (
    input.subject !== null &&
    input.online &&
    state.access === "allowed" &&
    state.history.status === "ready" &&
    state.sendCapable &&
    !state.resyncRequired &&
    !state.interrupted &&
    state.send.status !== "submitting" &&
    input.draft.trim().length >= 1 &&
    input.draft.trim().length <= input.maxLength
  );
}

export function applyViewTransition(
  state: ConversationViewState,
  action: ConversationAction,
): ConversationViewState {
  switch (action.type) {
    case "access-allowed":
      return { ...state, access: "allowed", sendCapable: true };
    case "access-unauthorized":
      return {
        ...state,
        access: "unauthorized",
        history: { status: "error", message: "이 대화를 볼 수 있는 권한이 없어요." },
        send: { status: "none" },
        sendCapable: false,
        interrupted: false,
        resyncRequired: false,
        unreadCount: 0,
      };
    case "access-unavailable":
      return { ...state, access: "unavailable", sendCapable: false, send: { status: "none" } };
    case "access-error":
      return {
        ...state,
        access: "error",
        history: { status: "error", message: "대화 상태를 확인하지 못했어요. 다시 시도해 주세요." },
        send: { status: "none" },
        sendCapable: false,
      };
    case "history-loading":
      return { ...state, history: { status: "loading" }, appendError: null };
    case "history-ready": {
      if (action.append && state.history.status === "ready") {
        const items = action.dedupe ? mergeById(state.history.items, action.page.items) : [...state.history.items, ...action.page.items];
        return { ...state, history: { status: "ready", items, nextCursor: action.page.nextCursor }, appendError: null };
      }
      // A successful fresh read is the only recovery from resync/interruption.
      return {
        ...state,
        history: { status: "ready", items: action.page.items, nextCursor: action.page.nextCursor },
        appendError: null,
        resyncRequired: false,
        interrupted: false,
        sendCapable: state.sendCapable,
      };
    }
    case "history-error":
      return { ...state, history: { status: "error", message: action.message }, send: { status: "none" } };
    case "append-error":
      return { ...state, appendError: action.message };
    case "send-submitting":
      return { ...state, send: { status: "submitting" } };
    case "send-acknowledged": {
      return {
        ...state,
        send: { status: "none" },
        history: state.history.status === "ready" ? { ...state.history, items: mergeById(state.history.items, [action.message]) } : state.history,
      };
    }
    case "send-failed":
      return { ...state, send: { status: "failed", message: action.message } };
    case "send-outcome-unknown":
      return { ...state, send: { status: "outcome-unknown" } };
    case "prepend-message": {
      if (!action.authoritativeOrder || state.history.status !== "ready") return state;
      if (state.history.items.some((message) => message.id === action.message.id)) return state;
      return { ...state, history: { ...state.history, items: [...state.history.items, action.message] } };
    }
    case "unread-increment":
      return { ...state, unreadCount: state.unreadCount + 1 };
    case "unread-add":
      return { ...state, unreadCount: state.unreadCount + action.count };
    case "unread-reset":
      return { ...state, unreadCount: 0 };
    case "realtime-interrupted":
      return { ...state, interrupted: true, resyncRequired: true, sendCapable: false };
    case "realtime-restored":
      return { ...state, interrupted: false, resyncRequired: true };
    case "resync-required":
      return { ...state, resyncRequired: true, sendCapable: false };
    case "reset":
      return { ...initialState(), sessionKey: action.sessionKey };
  }
}

/**
 * Maps a test-only realtime event into a presentation action so a view can
 * render interruption, resync demands, message arrival, and revocation
 * without owning any transport. No production realtime lane exists in this
 * build; this exists so test adapters can drive the exact UI states.
 */
export function eventToAction(
  event: ConversationEvent,
): ConversationAction {
  switch (event.type) {
    case "message":
      return { type: "prepend-message", message: event.message, authoritativeOrder: event.authoritativeOrder };
    case "resync-required":
      return { type: "resync-required" };
    case "access-revoked":
      return { type: "reset", sessionKey: event.sessionKey };
    case "connection-state":
      if (event.state === "live" || event.state === "reconnecting") {
        return { type: "realtime-restored" };
      }
      if (event.state === "interrupted") {
        return { type: "realtime-interrupted" };
      }
      return { type: "access-unauthorized" };
  }
}

export function visibleUnread(state: ConversationViewState): number {
  return state.unreadCount;
}

function mergeById(existing: Message[], incoming: Message[]): Message[] {
  const seen = new Set<string>();
  const result: Message[] = [];
  for (const message of [...existing, ...incoming]) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    result.push(message);
  }
  return result;
}
