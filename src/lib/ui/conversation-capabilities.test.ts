import { describe, expect, it } from "vitest";

import { connectionCapabilities } from "./conversation-capabilities";

describe("conversation-capabilities production gate", () => {
  it("declares every connection conversation capability contract-missing", () => {
    const capabilities = connectionCapabilities();
    for (const capability of ["history", "send", "realtime", "reportMessage", "blockCounterpart"] as const) {
      expect(capabilities[capability]).toEqual({ state: "unavailable", reason: "contract-missing" });
    }
  });
});
