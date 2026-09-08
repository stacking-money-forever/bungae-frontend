"use client";
import { useEffect, useState } from "react";

import { AnimatedDialog, AnimatedDialogDescription, AnimatedDialogTitle } from "@/components/animated-dialog";
import { promptInstall, readInstallState, type InstallPromptState } from "@/lib/pwa/install-state";

type Phase = "hidden" | "banner" | "ios-guide";

const DISMISS_STORAGE_KEY = "bungae.install-banner-dismissed";
const BANNER_DELAY_MS = 4000;

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Install surface. Chromium: native prompt banner. iOS Safari: manual
 * home-screen guide (Apple offers no programmatic prompt). Never rendered
 * for users already running standalone.
 */
export function InstallPrompt() {
  const [installState, setInstallState] = useState<InstallPromptState | null>(null);
  const [phase, setPhase] = useState<Phase>("hidden");
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const state = readInstallState();
    setInstallState(state);
    if (state.isStandalone || readDismissed()) return;

    // iOS does not expose beforeinstallprompt. Show its manual route as soon
    // as this client island hydrates instead of waiting for an event it never
    // emits.
    if (state.isIOSBrowser) {
      setPhase("banner");
      return;
    }

    const onPromptAvailable = () => {
      const updated = readInstallState();
      setInstallState(updated);
      if (updated.canPrompt && !updated.isStandalone) setPhase("banner");
    };

    // Chromium fires beforeinstallprompt early; poll-free approach is a
    // delayed re-check plus the captured singleton when it already fired.
    const timer = window.setTimeout(onPromptAvailable, BANNER_DELAY_MS);
    window.addEventListener("beforeinstallprompt", onPromptAvailable);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPromptAvailable);
    };
  }, []);

  const openIOSGuide = () => {
    setPhase("ios-guide");
    setGuideOpen(true);
  };

  const dismiss = (remember = true) => {
    setPhase("hidden");
    if (!remember) return;
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    } catch {
      // Private mode: banner may reappear next visit. Acceptable.
    }
  };

  const onBannerAction = async () => {
    if (installState?.isIOSBrowser) {
      openIOSGuide();
      return;
    }

    const outcome = await promptInstall();
    if (outcome === "unavailable") {
      // The native prompt rejected or never completed. This is not a user
      // choice, so hide only for this session and do not record a permanent
      // dismissal; a later visit can retry the install path.
      dismiss(false);
      return;
    }
    dismiss(true);
  };

  if (!installState || installState.isStandalone || phase === "hidden") {
    return null;
  }

  return (
    <>
      {phase === "banner" ? (
        <div
          role="region"
          aria-label="앱 설치"
          className="install-prompt-banner fixed inset-x-0 bottom-[var(--occupied-bottom)] z-30 flex justify-center px-5"
        >
          <div className="flex w-full max-w-[var(--screen-product-width)] items-center gap-3 rounded-[16px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] p-4 shadow-[0_8px_24px_rgba(22,22,22,0.12)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--brand-accent)] text-[20px]" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-neutral)]">
                <circle cx="12" cy="8.4" r="3.4" />
                <path d="M5.6 20c1.2-4 4-6 6.4-6s5.2 2 6.4 6" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[14px] font-bold leading-[20px] text-[var(--fg-neutral)]">
                벙개를 앱으로 쓰세요
              </p>
              <p className="m-0 text-[12px] leading-[16px] text-[var(--fg-muted)]">
                {installState.isIOSBrowser
                  ? "홈 화면에 추가해 앱처럼 열어보세요"
                  : "홈 화면에 추가해 더 빠르게 열어보세요"}
              </p>
            </div>
            <button
              type="button"
              onClick={onBannerAction}
              className="h-9 shrink-0 rounded-full bg-[var(--brand-accent)] px-4 text-[13px] font-bold text-[var(--fg-neutral)]"
            >
              {installState.isIOSBrowser ? "추가 방법" : "설치"}
            </button>
            <button
              type="button"
              onClick={() => dismiss()}
              aria-label="설치 배너 닫기"
              className="h-9 w-9 shrink-0 rounded-full text-[var(--fg-muted)]"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mx-auto" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      <AnimatedDialog open={guideOpen} onOpenChange={(open) => {
        setGuideOpen(open);
        if (!open) dismiss();
      }}>
        <AnimatedDialogTitle className="m-0 text-[18px] font-bold text-[var(--fg-neutral)]">
          홈 화면에 벙개 추가하기
        </AnimatedDialogTitle>
        <AnimatedDialogDescription className="mt-2 text-[13px] leading-[18px] text-[var(--fg-muted)]">
          iPhone에서 아래 순서대로 추가하면 앱처럼 쓸 수 있어요
        </AnimatedDialogDescription>
        <ol className="mt-4 flex flex-col gap-3 pl-5 text-[14px] leading-[20px] text-[var(--fg-neutral)]">
          <li>Safari 하단 <strong>공유</strong> 버튼 탭</li>
          <li>목록에서 <strong>홈 화면에 추가</strong> 선택</li>
          <li>오른쪽 위 <strong>추가</strong> 탭</li>
        </ol>
        <button
          type="button"
          onClick={() => dismiss()}
          className="mt-6 h-[52px] w-full rounded-[16px] bg-[var(--brand-accent)] text-[16px] font-bold text-[var(--fg-neutral)]"
        >
          확인
        </button>
      </AnimatedDialog>
    </>
  );
}
