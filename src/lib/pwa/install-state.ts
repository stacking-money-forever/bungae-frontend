"use client";


export type InstallPromptState = {
  /** Native prompt available (Chromium). */
  canPrompt: boolean;
  /** Already running as installed app. */
  isStandalone: boolean;
  /** iOS Safari not installed standalone — show manual guide. */
  isIOSBrowser: boolean;
};

type BrowserInstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * beforeinstallprompt must be captured the moment it fires, potentially
 * before React hydrates. A module-level singleton keeps it available for
 * the install banner whenever the user gets around to clicking.
 */
let capturedPrompt: BrowserInstallEvent | null = null;

function capturePrompt(event: Event) {
  event.preventDefault();
  capturedPrompt = event as BrowserInstallEvent;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", capturePrompt);
}

export function isIOSUserAgent(): boolean {
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && "ontouchend" in document)
  );
}

export function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari proprietary marker for home-screen web apps.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function readInstallState(): InstallPromptState {
  if (typeof window === "undefined") {
    return { canPrompt: false, isStandalone: true, isIOSBrowser: false };
  }
  return {
    canPrompt: capturedPrompt !== null,
    isStandalone: isStandaloneDisplay(),
    isIOSBrowser: isIOSUserAgent(),
  };
}

/** Fire the native Chromium install prompt. Returns the user's outcome. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!capturedPrompt) return "unavailable";
  const prompt = capturedPrompt;
  capturedPrompt = null;
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome;
  } catch {
    // A rejected native prompt (for example a transient browser error) must
    // not leave the app believing an install succeeded or crashed. The
    // banner consumes the outcome and stays dismissable.
    return "unavailable";
  }
}

/** Test hook: seed the singleton when jsdom cannot fire beforeinstallprompt. */
export function __setCapturedPrompt(event: BrowserInstallEvent | null) {
  capturedPrompt = event;
}
