import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __setCapturedPrompt,
  promptInstall,
  readInstallState,
} from "@/lib/pwa/install-state";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function makePromptEvent(outcome: "accepted" | "dismissed"): PromptEvent {
  const event = new Event("beforeinstallprompt") as PromptEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe("install-state", () => {
  afterEach(() => {
    __setCapturedPrompt(null);
    vi.restoreAllMocks();
  });

  it("reports no prompt and standalone-safe defaults before capture", () => {
    const state = readInstallState();
    expect(state.canPrompt).toBe(false);
    expect(state.isStandalone).toBe(false);
    expect(state.isIOSBrowser).toBe(false);
  });

  it("marks prompt available once an event is captured", () => {
    __setCapturedPrompt(makePromptEvent("accepted"));
    expect(readInstallState().canPrompt).toBe(true);
  });

  it("fires the prompt once and returns the accepted outcome", async () => {
    const event = makePromptEvent("accepted");
    __setCapturedPrompt(event);

    await expect(promptInstall()).resolves.toBe("accepted");
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it("consumes the captured prompt so it cannot fire twice", async () => {
    __setCapturedPrompt(makePromptEvent("dismissed"));

    await expect(promptInstall()).resolves.toBe("dismissed");
    await expect(promptInstall()).resolves.toBe("unavailable");
    expect(readInstallState().canPrompt).toBe(false);
  });

  it("returns unavailable when nothing was captured", async () => {
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("returns unavailable and consumes the prompt when the native prompt rejects", async () => {
    const event = makePromptEvent("accepted");
    event.prompt = vi.fn().mockRejectedValue(new Error("browser cancelled"));
    __setCapturedPrompt(event);

    await expect(promptInstall()).resolves.toBe("unavailable");
    await expect(promptInstall()).resolves.toBe("unavailable");
    expect(readInstallState().canPrompt).toBe(false);
  });

  it("detects iOS Safari from the user agent", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    );
    expect(readInstallState().isIOSBrowser).toBe(true);
  });

  it("detects installed standalone mode on iOS via navigator.standalone", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    );
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: true,
    });

    const state = readInstallState();
    expect(state.isStandalone).toBe(true);
    expect(state.isIOSBrowser).toBe(true);

    delete (window.navigator as Navigator & { standalone?: boolean }).standalone;
  });

  it("matches the standalone display-mode media query on desktop", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
      const list = {
        media: query,
        matches: query === "(display-mode: standalone)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
      return list as unknown as MediaQueryList;
    });

    expect(readInstallState().isStandalone).toBe(true);
  });
});
