"use client";

import {
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

type Connection = {
  id: string;
  initials: string;
  name: string;
  meetup: string;
  when: string;
};

const initialConnections: Connection[] = [
  { id: "minji", initials: "민", name: "민지", meetup: "합정 보드게임", when: "오늘 19:00" },
  { id: "doyoon", initials: "도", name: "도윤", meetup: "퇴근 후 한강 산책", when: "어제 18:30" },
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState(initialConnections);
  const [pendingEnd, setPendingEnd] = useState<Connection | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const actionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const countTitleRef = useRef<HTMLHeadingElement>(null);
  const shouldRestoreFocus = useRef(false);
  const focusTargetId = useRef<string | null>(null);
  const pendingEndCommitId = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();

  const confirmEnd = () => {
    if (!pendingEnd) return;
    const pendingIndex = connections.findIndex(({ id }) => id === pendingEnd.id);
    shouldRestoreFocus.current = true;
    focusTargetId.current = connections[pendingIndex + 1]?.id ?? null;
    pendingEndCommitId.current = pendingEnd.id;
    setPendingEnd(null);
  };

  const commitEndAfterExit = (connection: Connection) => {
    if (pendingEndCommitId.current !== connection.id) {
      return;
    }

    pendingEndCommitId.current = null;
    setStatusMessage(`${connection.name}님과의 연결을 종료했어요.`);
    setConnections((current) => current.filter(({ id }) => id !== connection.id));
  };

  useEffect(() => {
    if (!shouldRestoreFocus.current) return;
    shouldRestoreFocus.current = false;
    const nextAction = focusTargetId.current ? actionRefs.current[focusTargetId.current] : null;
    (nextAction ?? countTitleRef.current)?.focus();
  }, [connections]);

  return (
    <ScreenShell className="px-5 pb-8">
      <TopNavigation
        href="/profile"
        title={<span className="font-display text-[16px] font-normal leading-6">연결 목록</span>}
        trailing={
          <span className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--fg-neutral)]" aria-label="상호 선택 연결">
            <ShieldCheck size={24} strokeWidth={1.8} aria-hidden="true" />
          </span>
        }
        className="-mx-5 px-4"
      />

      <section className="pt-4" aria-labelledby="connections-intro-title">
        <h1 id="connections-intro-title" className="m-0 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">서로 선택한 사람만 연결돼요.</h1>
        <p className="m-0 mt-1 text-[14px] leading-[22px] text-[var(--fg-muted)]">한쪽의 선택은 상대에게 공개되지 않아요.</p>
      </section>

      <section className="mt-7" aria-labelledby="connections-count-title">
        <h2
          ref={countTitleRef}
          id="connections-count-title"
          tabIndex={-1}
          className="m-0 text-[13px] font-normal leading-5 text-[var(--fg-muted)]"
        >
          연결된 사람 {connections.length}명
        </h2>
        <ul className={`m-0 list-none p-0 ${connections.length > 0 ? "mt-2" : ""}`}>
          <AnimatePresence initial={false} mode="popLayout">
            {connections.map((connection) => (
              <motion.li
                key={connection.id}
                layout
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
                className="flex min-h-[84px] items-center gap-3 border-b border-[var(--stroke-neutral)] py-3"
              >
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[16px] font-bold text-[var(--fg-on-brand)]" aria-hidden="true">{connection.initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold leading-5 text-[var(--fg-neutral)]">{connection.name}</span>
                  <span className="block truncate text-[11px] font-medium leading-4 text-[var(--fg-muted)]">{connection.meetup} · {connection.when}</span>
                </span>
                <AnimatedDialog
                  open={pendingEnd?.id === connection.id}
                  onOpenChange={(open) => {
                    if (open) {
                      setPendingEnd(connection);
                    } else {
                      setPendingEnd((current) => (current?.id === connection.id ? null : current));
                    }
                  }}
                  onExitComplete={() => {
                    if (pendingEndCommitId.current === connection.id) {
                      commitEndAfterExit(connection);
                    } else {
                      actionRefs.current[connection.id]?.focus();
                    }
                  }}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                  trigger={
                    <button
                      type="button"
                      ref={(element) => {
                        actionRefs.current[connection.id] = element;
                      }}
                      className="inline-flex min-h-[44px] shrink-0 items-center px-2 text-[14px] font-bold text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                      aria-label={`${connection.name}님과 연결 종료`}
                    >
                      연결 종료
                    </button>
                  }
                  className="max-w-[390px]"
                >
                  <AnimatedDialogTitle className="m-0 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">
                    연결을 종료할까요?
                  </AnimatedDialogTitle>
                  <AnimatedDialogDescription className="m-0 mt-2 text-[14px] leading-[22px] text-[var(--fg-muted)]">
                    {connection.name}님과의 1:1 대화가 닫혀요. 다시 연결하려면 같은 모임에서 서로 선택해야 해요.
                  </AnimatedDialogDescription>
                  <div className="mt-4 flex gap-2">
                    <AnimatedDialogClose asChild>
                      <button
                        type="button"
                        className="min-h-[52px] flex-1 border border-[var(--stroke-neutral)] px-3 text-[15px] font-bold text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                      >
                        취소
                      </button>
                    </AnimatedDialogClose>
                    <button
                      type="button"
                      className="min-h-[52px] flex-1 bg-[var(--fg-neutral)] px-3 text-[15px] font-bold text-[var(--bg-layer-floating)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                      onClick={confirmEnd}
                    >
                      연결 종료
                    </button>
                  </div>
                </AnimatedDialog>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {connections.length === 0 ? (
          <p className="m-0 mt-4 border-b border-[var(--stroke-neutral)] pb-4 text-[14px] leading-[22px] text-[var(--fg-muted)]" role="status">아직 연결된 사람이 없어요.</p>
        ) : null}
      </section>

      <p className="m-0 mt-4 flex items-start gap-3 text-[14px] leading-6 text-[var(--fg-muted)]">
        <LockKeyhole className="mt-0.5 shrink-0" size={22} strokeWidth={1.8} aria-hidden="true" />
        <span>연결은 같은 모임에서 체크인한 사람끼리만 만들 수 있어요.</span>
      </p>
      <p className="sr-only" aria-live="polite">{statusMessage}</p>

    </ScreenShell>
  );
}
