import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/ui/online";

/**
 * Offline connectivity hint. Renders only while the browser reports the link
 * is down. It is a polite hint, never a server-availability verdict: request
 * failures keep their own error/retry surfaces. Callers gate destructive or
 * remote mutations themselves; this banner never disables controls directly.
 */
export function OfflineNotice({ className }: { className?: string }) {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        "flex items-start gap-2 rounded-[12px] bg-[var(--bg-neutral-weak)] p-3 text-[var(--fg-neutral)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <WifiOff size={18} strokeWidth={1.8} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--fg-muted)]" />
      <div className="min-w-0">
        <p className="m-0 text-[13px] font-semibold leading-5">인터넷 연결이 끊겼어요</p>
        <p className="m-0 text-[13px] leading-5 text-[var(--fg-muted)]">
          지금은 변경을 저장하거나 서버 정보를 불러올 수 없어요. 연결이 돌아오면 다시 시도해 주세요.
        </p>
      </div>
    </aside>
  );
}
