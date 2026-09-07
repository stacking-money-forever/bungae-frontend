"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

import {
  readPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushDependencies,
  type PushSubscriptionState,
  type SubscribeResult,
  type UnsubscribeResult,
} from "@/lib/pwa/push";

const SUPPORT_COPY: Record<PushSubscriptionState["support"], string> = {
  unavailable: "이 기기에서는 알림을 지원하지 않아요",
  "requires-install": "홈 화면에 추가한 후 알림을 켤 수 있어요",
  "missing-fcm-config": "알림 서버 설정이 준비 중이에요",
  "unavailable-auth": "로그인 정보가 연결되면 알림을 설정할 수 있어요",
  "account-switch-cleanup-required": "이전 계정의 알림 해제가 먼저 필요해요",
  "rollback-cleanup-required":
    "이전 알림 등록을 정리한 뒤 새 알림을 등록할 수 있어요.",
  "permission-denied": "브라우저 설정에서 알림 권한을 허용해 주세요",
  "service-worker-unavailable": "앱을 새로고침한 뒤 다시 시도해 주세요",
  "storage-unavailable": "이 브라우저에서는 알림 설정을 저장할 수 없어요",
  ready: "모임 소식과 채팅 알림을 받아보세요",
};

type ActionErrorReason =
  | Extract<SubscribeResult, { ok: false }>["reason"]
  | Extract<UnsubscribeResult, { ok: false }>["reason"]
  | "unexpected";

const ACTION_ERROR_COPY: Partial<Record<ActionErrorReason, string>> = {
  "local-storage-write-rolled-back":
    "알림 설정을 저장하지 못해 서버 등록을 되돌렸어요. 다시 시도해 주세요.",
  "rollback-cleanup-required":
    "이전 알림 등록 정리에 실패했어요. 같은 등록을 다시 정리해 주세요.",
  "storage-unavailable": "이 브라우저에서는 알림 설정을 저장할 수 없어요.",
  unexpected: "알림 설정을 처리하지 못했어요. 다시 시도해 주세요.",
};

/**
 * Push opt-in card. Without an injected authenticated session it intentionally
 * remains unavailable rather than inventing a client-side JWT or success.
 */
export function PushSettingsCard({
  dependencies,
}: {
  dependencies?: PushDependencies;
}) {
  const [state, setState] = useState<PushSubscriptionState | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<ActionErrorReason | null>(null);
  const [cleanupComplete, setCleanupComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readPushState(dependencies).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [dependencies]);

  const toggle = async () => {
    if (!state || pending) return;
    setPending(true);
    setActionError(null);
    setCleanupComplete(false);
    try {
      if (state.subscribed) {
        const result = await unsubscribeFromPush(dependencies);
        if (result.ok) {
          setState({ ...state, subscribed: false });
        } else {
          setActionError(result.reason);
        }
        return;
      }
      const result = await subscribeToPush(dependencies);
      if (result.ok) {
        if (result.action === "subscribed") {
          setState({ ...state, subscribed: true });
        } else {
          setState({ ...state, support: "ready", subscribed: false });
          setCleanupComplete(true);
        }
      } else if (result.reason === "permission-denied") {
        setState({ ...state, support: "permission-denied" });
      } else if (result.reason === "rollback-cleanup-required") {
        setState({ ...state, support: "rollback-cleanup-required" });
      } else {
        setActionError(result.reason);
      }
    } catch {
      setActionError("unexpected");
    } finally {
      setPending(false);
    }
  };

  if (!state) return null;

  const isRollbackCleanup = state.support === "rollback-cleanup-required";
  const description = cleanupComplete
    ? "이전 서버 등록을 정리했어요. 이제 새 알림을 켤 수 있어요."
    : actionError
      ? (ACTION_ERROR_COPY[actionError] ?? "알림 설정을 저장하지 못했어요. 다시 시도해 주세요.")
      : state.support !== "ready"
        ? SUPPORT_COPY[state.support]
        : state.subscribed
          ? "모임 소식과 채팅 알림을 받고 있어요"
          : SUPPORT_COPY[state.support];
  const actionLabel = isRollbackCleanup
    ? "정리 다시 시도"
    : state.subscribed
      ? "끄기"
      : actionError
        ? "다시 시도"
        : "켜기";
  const disabled =
    pending ||
    (!state.subscribed && state.support !== "ready" && !isRollbackCleanup);
  return (
    <div className="flex min-h-[68px] items-center gap-3 border-b border-[var(--stroke-neutral)] py-2">
      {state.subscribed ? (
        <Bell className="shrink-0 text-[var(--fg-neutral)]" size={22} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <BellOff className="shrink-0 text-[var(--fg-muted)]" size={22} strokeWidth={1.8} aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[length:var(--type-title)] leading-5 text-[var(--fg-neutral)]">
          모임 알림 받기
        </p>
        <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className="min-h-[36px] shrink-0 rounded-full border border-[var(--fg-neutral)] px-4 text-[13px] font-bold text-[var(--fg-neutral)] disabled:border-[var(--fg-muted)] disabled:text-[var(--fg-muted)]"
      >
        {actionLabel}
      </button>
    </div>
  );
}
