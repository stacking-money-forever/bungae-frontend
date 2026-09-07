"use client";

import { useCallback, useEffect, useState } from "react";

import { AnimatedDialog, AnimatedDialogTitle } from "@/components/animated-dialog";
import { InstallPrompt } from "@/components/install-prompt";
import { useServiceWorkerRegistration } from "@/lib/pwa/use-service-worker-registration";

/**
 * Global PWA lifecycle feedback, mounted once from the server layout.
 *
 * A waiting update is announced but never applied silently: applying it
 * reloads the page, which would discard drafts and in-flight submissions, so
 * the confirm step warns when the user may lose work. When nothing is dirty
 * the update applies on the first confirm with a single reload.
 */

/**
 * Conservative local heuristic for "work could be lost by a reload". There is
 * no cross-route dirty registry, so the update confirm warns whenever the
 * live document contains typed text, a selected option beyond a <select>
 * default, a checked choice, or a chosen file. Over-warning is safe (the
 * user can still proceed); under-warning would discard drafts silently.
 */
function hasDirtyOrPendingForm(): boolean {
  if (typeof document === "undefined") return false;
  const elements = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
  for (const element of elements) {
    if (element instanceof HTMLTextAreaElement) {
      if (element.value.trim().length > 0) return true;
    } else if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox" || element.type === "radio") {
        if (element.checked) return true;
      } else if (element.type === "file") {
        if (element.files && element.files.length > 0) return true;
      } else if (element.value.trim().length > 0) {
        return true;
      }
    }
  }
  return false;
}

export function PwaRoot() {
  const { status, applyUpdate, retryRegistration } = useServiceWorkerRegistration();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dirtyWarning, setDirtyWarning] = useState(false);

  // While the confirm dialog is open the document may change (drafts typed,
  // requests settled); keep the warning honest at apply time. The update is
  // only armed when the user confirms.
  useEffect(() => {
    if (confirmOpen) {
      setDirtyWarning(hasDirtyOrPendingForm());
    }
  }, [confirmOpen]);

  const onRequestUpdate = useCallback(() => {
    setDirtyWarning(hasDirtyOrPendingForm());
    setConfirmOpen(true);
  }, []);

  const onConfirmUpdate = useCallback(() => {
    setConfirmOpen(false);
    applyUpdate();
  }, [applyUpdate]);

  const banner =
    status === "update-available" ? (
      <section
        role="status"
        aria-live="polite"
        aria-label="새 버전 안내"
        className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-40 flex justify-center px-5"
      >
        <div className="flex w-full max-w-[var(--screen-product-width)] items-center gap-3 rounded-[16px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] p-3 shadow-[0_8px_24px_rgba(22,22,22,0.12)]">
          <p className="m-0 min-w-0 flex-1 text-[13px] leading-[18px] text-[var(--fg-neutral)]">
            새 버전이 준비되었어요. 새로고침하면 적용됩니다.
          </p>
          <button
            type="button"
            onClick={onRequestUpdate}
            className="h-9 shrink-0 rounded-full bg-[var(--brand-accent)] px-4 text-[13px] font-bold text-[var(--fg-neutral)]"
          >
            새로고침
          </button>
        </div>
      </section>
    ) : null;

  const failureBanner =
    status === "failed" ? (
      <section
        role="status"
        aria-live="polite"
        aria-label="업데이트 확인 실패"
        className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-40 flex justify-center px-5"
      >
        <div className="flex w-full max-w-[var(--screen-product-width)] items-center gap-3 rounded-[16px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] p-3 shadow-[0_8px_24px_rgba(22,22,22,0.12)]">
          <p className="m-0 min-w-0 flex-1 text-[13px] leading-[18px] text-[var(--fg-neutral)]">
            업데이트 상태를 확인하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={retryRegistration}
            className="h-9 shrink-0 rounded-full border border-[var(--stroke-neutral)] px-4 text-[13px] font-bold text-[var(--fg-neutral)]"
          >
            다시 시도
          </button>
        </div>
      </section>
    ) : null;

  return (
    <>
      <InstallPrompt />
      {banner}
      {failureBanner}
      <AnimatedDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setDirtyWarning(false);
        }}
      >
        <AnimatedDialogTitle className="m-0 text-[18px] font-bold text-[var(--fg-neutral)]">
          {dirtyWarning ? "입력 내용이 있어요" : "새 버전으로 새로고침할까요?"}
        </AnimatedDialogTitle>
        <p className="mt-2 text-[14px] leading-[20px] text-[var(--fg-muted)]">
          {dirtyWarning
            ? "새 버전 적용을 위해 페이지를 새로고침하면 작성 중인 내용과 진행 중인 요청이 사라질 수 있어요."
            : "새 버전을 적용하려면 페이지를 새로고침해야 해요."}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="h-[52px] min-w-0 flex-1 rounded-[16px] border border-[var(--stroke-neutral)] px-3 text-[15px] font-bold text-[var(--fg-neutral)]"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={onConfirmUpdate}
            className="h-[52px] min-w-0 flex-1 rounded-[16px] bg-[var(--brand-accent)] px-3 text-[15px] font-bold text-[var(--fg-neutral)]"
          >
            새로고침
          </button>
        </div>
      </AnimatedDialog>
    </>
  );
}
