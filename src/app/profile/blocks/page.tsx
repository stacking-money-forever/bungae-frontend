"use client";

import {
  Info,
  LockKeyhole,
} from "lucide-react";
import { useState } from "react";

import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

type BlockedPerson = {
  id: string;
  initials: string;
  name: string;
  details: string;
};

const initialBlockedPeople: BlockedPerson[] = [
  { id: "jimin", initials: "지", name: "지민", details: "30대 · 산책" },
  { id: "seoyeon", initials: "서", name: "서연", details: "20대 · 카페 대화" },
];

export default function BlocksPage() {
  const [blockedPeople, setBlockedPeople] = useState(initialBlockedPeople);
  const [pendingUnblock, setPendingUnblock] = useState<BlockedPerson | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const confirmUnblock = () => {
    if (!pendingUnblock) return;
    setBlockedPeople((current) => current.filter(({ id }) => id !== pendingUnblock.id));
    setStatusMessage(`${pendingUnblock.name}님 차단을 해제했어요.`);
    setPendingUnblock(null);
  };

  return (
    <ScreenShell className="px-5 pb-8">
      <TopNavigation
        href="/profile"
        title={<span className="font-display text-[16px] font-normal leading-6">차단 목록</span>}
        trailing={
          <span className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--fg-muted)]" aria-label="나만 볼 수 있는 목록">
            <LockKeyhole size={24} strokeWidth={1.8} aria-hidden="true" />
          </span>
        }
        className="-mx-5 px-4"
      />

      <section className="pt-4" aria-labelledby="blocks-intro-title">
        <h1 id="blocks-intro-title" className="m-0 text-[14px] font-bold leading-[22px] text-[var(--fg-neutral)]">차단한 사람은 서로의 모임과 프로필에 보이지 않아요.</h1>
        <p className="m-0 mt-1 text-[14px] leading-[22px] text-[var(--fg-muted)]">차단 목록은 나만 볼 수 있어요.</p>
      </section>

      <section className="mt-2" aria-labelledby="blocked-count-title">
        <h2 id="blocked-count-title" className="m-0 text-[13px] font-normal leading-5 text-[var(--fg-muted)]">차단한 사람 {blockedPeople.length}명</h2>
        {blockedPeople.length > 0 ? (
          <ul className="m-0 mt-2 list-none p-0">
            {blockedPeople.map((person) => (
              <li key={person.id} className="flex min-h-[64px] items-center gap-3 border-b border-[var(--stroke-neutral)] py-2">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--bg-layer-floating)] text-[16px] font-bold text-[var(--fg-neutral)]" aria-hidden="true">{person.initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold leading-5 text-[var(--fg-neutral)]">{person.name}</span>
                  <span className="block text-[11px] font-medium leading-4 text-[var(--fg-muted)]">{person.details}</span>
                </span>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] shrink-0 items-center px-2 text-[14px] font-bold text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                  onClick={() => setPendingUnblock(person)}
                  aria-label={`${person.name}님 차단 해제`}
                >
                  차단 해제
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-4 border-b border-[var(--stroke-neutral)] pb-4 text-[14px] leading-[22px] text-[var(--fg-muted)]" role="status">차단한 사람이 없어요.</p>
        )}
      </section>

      <p className="m-0 mt-4 flex items-start gap-3 text-[14px] leading-6 text-[var(--fg-muted)]">
        <Info className="mt-0.5 shrink-0" size={22} strokeWidth={1.8} aria-hidden="true" />
        <span>차단을 해제하면 이후 모임에서 다시 만날 수 있어요.</span>
      </p>
      <p className="sr-only" aria-live="polite">{statusMessage}</p>

      {pendingUnblock ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/20 px-5 pb-[max(20px,env(safe-area-inset-bottom))]" role="presentation">
          <section className="w-full max-w-[390px] rounded-2xl bg-[var(--bg-layer-floating)] p-5" role="alertdialog" aria-modal="true" aria-labelledby="unblock-title" aria-describedby="unblock-description">
            <h2 id="unblock-title" className="m-0 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">차단을 해제할까요?</h2>
            <p id="unblock-description" className="m-0 mt-2 text-[14px] leading-[22px] text-[var(--fg-muted)]">{pendingUnblock.name}님이 이후 모임과 프로필에 다시 보이고, 서로 만날 수 있어요.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="min-h-[52px] flex-1 border border-[var(--stroke-neutral)] px-3 text-[15px] font-bold text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                onClick={() => setPendingUnblock(null)}
                autoFocus
              >
                취소
              </button>
              <button
                type="button"
                className="min-h-[52px] flex-1 bg-[var(--fg-neutral)] px-3 text-[15px] font-bold text-[var(--bg-layer-floating)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                onClick={confirmUnblock}
              >
                차단 해제
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </ScreenShell>
  );
}
