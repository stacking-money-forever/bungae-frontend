import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InstallPrompt } from "@/components/install-prompt";
import { __setCapturedPrompt } from "@/lib/pwa/install-state";
import { installLocalStorageStub, stubMatchMedia } from "@/test/pwa-stubs";

const DISMISS_STORAGE_KEY = "bungae.install-banner-dismissed";

function capturePrompt(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  __setCapturedPrompt(event);
  return event;
}

describe("InstallPrompt", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    installLocalStorageStub();
    stubMatchMedia(false);
    __setCapturedPrompt(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    __setCapturedPrompt(null);
  });

  it("renders nothing when nothing is captured and no prompt fires", () => {
    render(<InstallPrompt />);
    vi.advanceTimersByTime(5000);
    expect(screen.queryByRole("region", { name: "앱 설치" })).not.toBeInTheDocument();
  });

  it("shows the banner once beforeinstallprompt has been captured", async () => {
    capturePrompt("accepted");
    render(<InstallPrompt />);

    vi.advanceTimersByTime(4500);
    expect(await screen.findByRole("region", { name: "앱 설치" })).toBeInTheDocument();
  });

  it("hides itself after a successful install", async () => {
    capturePrompt("accepted");
    render(<InstallPrompt />);

    vi.advanceTimersByTime(4500);
    fireEvent.click(await screen.findByRole("button", { name: "설치" }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "앱 설치" })).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe("1");
  });

  it("does not record a permanent dismissal when the native prompt rejects", async () => {
    const event = capturePrompt("accepted");
    event.prompt = vi.fn().mockRejectedValue(new Error("transient browser error"));
    render(<InstallPrompt />);

    vi.advanceTimersByTime(4500);
    fireEvent.click(await screen.findByRole("button", { name: "설치" }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "앱 설치" })).not.toBeInTheDocument();
    });
    // A rejected prompt is not a user choice: no permanent dismissal.
    expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBeNull();
  });

  it("dismisses on the close button and remembers the choice", async () => {
    capturePrompt("accepted");
    render(<InstallPrompt />);

    vi.advanceTimersByTime(4500);
    fireEvent.click(await screen.findByRole("button", { name: "설치 배너 닫기" }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "앱 설치" })).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe("1");

    // Remount: banner must stay hidden.
    render(<InstallPrompt />);
    vi.advanceTimersByTime(4500);
    expect(screen.queryByRole("region", { name: "앱 설치" })).not.toBeInTheDocument();
  });

  it("never shows for users already running standalone", () => {
    stubMatchMedia(true);
    capturePrompt("accepted");
    render(<InstallPrompt />);

    vi.advanceTimersByTime(4500);
    expect(screen.queryByRole("region", { name: "앱 설치" })).not.toBeInTheDocument();
  });

  it("shows iOS manual installation without beforeinstallprompt", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    );
    render(<InstallPrompt />);

    expect(await screen.findByRole("region", { name: "앱 설치" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "추가 방법" }));
    expect(await screen.findByText("홈 화면에 벙개 추가하기")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "앱 설치" })).not.toBeInTheDocument();
    });
  });
});
