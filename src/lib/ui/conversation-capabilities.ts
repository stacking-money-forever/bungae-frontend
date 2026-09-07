/**
 * Production capability gate for the 1:1 connection chat. The authoritative
 * `/v1/connections/{connectionId}` detail and message contracts do not exist
 * in this codebase yet (`docs/API_CONTRACT.md` rows 349-352 are proposals),
 * so every capability is statically `contract-missing`. A future adapter
 * implementing the contract may flip individual capabilities to available;
 * until it does, a view must never call send/realtime ports.
 *
 * This module must stay free of API client imports: it describes absence
 * without wiring anything.
 */

import type {
  CapabilityMap,
  ConversationCapability,
} from "@/lib/ui/conversation-domain";

const MISSING_REASON = "contract-missing" as const;

function contractMissing(): Record<ConversationCapability, { state: "unavailable"; reason: typeof MISSING_REASON }> {
  return {
    history: { state: "unavailable", reason: MISSING_REASON },
    send: { state: "unavailable", reason: MISSING_REASON },
    realtime: { state: "unavailable", reason: MISSING_REASON },
    reportMessage: { state: "unavailable", reason: MISSING_REASON },
    blockCounterpart: { state: "unavailable", reason: MISSING_REASON },
  };
}

/**
 * The production connection capability map: every feature is unavailable
 * because no detail/message adapter is wired. Views render an honest
 * unavailable state and never issue requests or claim connectivity.
 */
export function connectionCapabilities(): CapabilityMap {
  return contractMissing();
}

/** No send port exists for a connection conversation in this build. */
export const CONNECTION_SEND_UNAVAILABLE = true;
