"use client";

import { Clock3, ShieldCheck, UsersRound } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import { BottomActionBar } from "@/components/bottom-action-bar";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

const minimumParticipants = 3;
const capacity = 6;

function parseParticipants(value: string | null | undefined) {
  if (value === null || value === undefined || value.trim() === "") {
    return 2;
  }

  const requestedCount = Number(value);
  return Number.isInteger(requestedCount) && requestedCount >= 0
    ? requestedCount
    : 2;
}

type QuorumDecisionAction = "proceed" | "cancel";

interface QuorumConfirmationDialogProps {
  action: QuorumDecisionAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onExitComplete: () => void;
}

function QuorumConfirmationDialog({
  action,
  open,
  onOpenChange,
  onConfirm,
  onExitComplete,
}: QuorumConfirmationDialogProps) {
  const isProceed = action === "proceed";

  return (
    <AnimatedDialog
      open={open}
      onOpenChange={onOpenChange}
      placement="center"
      onExitComplete={onExitComplete}
      onCloseAutoFocus={(event) => event.preventDefault()}
    >
      <AnimatedDialogTitle
        className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]"
      >
        {isProceed ? "현재 인원으로 진행할까요?" : "모임을 취소할까요?"}
      </AnimatedDialogTitle>
      <AnimatedDialogDescription
        className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]"
      >
        {isProceed
          ? "참가자에게 진행 확정 소식을 알리고 체크인을 준비해요."
          : "인원 미달 취소는 출석 기록에 영향을 주지 않아요."}
      </AnimatedDialogDescription>
      <div className="mt-5 flex gap-2">
        <AnimatedDialogClose asChild>
          <button
            className="inline-flex min-h-[var(--target-min)] flex-1 items-center justify-center rounded-[10px] bg-[var(--bg-layer-floating)] px-3 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-neutral)] ring-1 ring-inset ring-[var(--stroke-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
          >
            돌아가기
          </button>
        </AnimatedDialogClose>
        <button
          className="inline-flex min-h-[var(--target-min)] flex-1 items-center justify-center rounded-[10px] bg-[var(--brand-accent)] px-3 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] ring-1 ring-inset ring-[var(--stroke-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          type="button"
          onClick={onConfirm}
        >
          {isProceed ? "진행하기" : "취소하기"}
        </button>
      </div>
    </AnimatedDialog>
  );
}

function QuorumDecisionPageContent() {
  const { meetupId } = useParams<{ meetupId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const encodedMeetupId = encodeURIComponent(meetupId ?? "han-river-walk");
  const meetupPath = `/meetups/${encodedMeetupId}`;
  const currentParticipants = parseParticipants(searchParams?.get("participants"));
  const [pendingAction, setPendingAction] = useState<"proceed" | "cancel" | null>(null);
  const [decision, setDecision] = useState<"pending" | "cancelled">("pending");
  const proceedTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingCommitActionRef = useRef<QuorumDecisionAction | null>(null);
  const lastOpenedActionRef = useRef<QuorumDecisionAction | null>(null);
  const reduceMotion = useReducedMotion();
  const resultTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.16, ease: "easeOut" as const };

  useEffect(() => {
    if (decision === "cancelled") {
      document.getElementById("quorum-decision-cancelled-result")?.focus();
    }
  }, [decision]);

  const canProceed = currentParticipants >= 2;

  function openConfirmation(action: QuorumDecisionAction) {
    lastOpenedActionRef.current = action;
    setPendingAction(action);
  }

  function confirmAction() {
    if (pendingAction === null || pendingCommitActionRef.current !== null) {
      return;
    }

    pendingCommitActionRef.current = pendingAction;
    setPendingAction(null);
  }

  function handleDialogExitComplete() {
    const commitAction = pendingCommitActionRef.current;
    if (commitAction !== null) {
      pendingCommitActionRef.current = null;
      lastOpenedActionRef.current = null;

      if (commitAction === "proceed") {
        router.push(`/meetups/${encodedMeetupId}/hub?confirmed=1`);
      } else {
        setDecision("cancelled");
      }
      return;
    }

    const dismissedAction = lastOpenedActionRef.current;
    lastOpenedActionRef.current = null;
    if (dismissedAction === "proceed") {
      proceedTriggerRef.current?.focus();
    } else if (dismissedAction === "cancel") {
      cancelTriggerRef.current?.focus();
    }
  }

  return (
    <>
      <QuorumConfirmationDialog
        action={pendingAction ?? "cancel"}
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
        onConfirm={confirmAction}
        onExitComplete={handleDialogExitComplete}
      />
      <AnimatePresence initial={false} mode="wait">
        {decision === "cancelled" ? (
          <motion.div
            key="cancelled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={resultTransition}
            onAnimationComplete={() => {
              document.getElementById("quorum-decision-cancelled-result")?.focus();
            }}
          >
          <ScreenShell bottomSpacing aria-label="인원 미달 취소 완료">
            <TopNavigation href={meetupPath} title="진행 여부 결정" />
            <ResultSection
              id="quorum-decision-cancelled-result"
              tabIndex={-1}
              className="px-[var(--dimension-x5)] pb-8 pt-12"
              tone="neutral"
              heading="모임을 취소했어요"
              description="인원 미달로 취소됐어요. 누구에게도 출석 불이익이 없어요."
            />
            <BottomActionBar>
              <Link
                className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                href="/my-meetups"
              >
                내 모임으로 돌아가기
              </Link>
            </BottomActionBar>
          </ScreenShell>
        </motion.div>
      ) : (
        <motion.div
          key="pending"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={resultTransition}
        >
          <ScreenShell bottomSpacing aria-label="최소 인원 미달 결정">
            <TopNavigation href={meetupPath} title="진행 여부 결정" />

            <section
              className="w-full bg-[var(--bg-warning-weak)] px-[var(--dimension-x5)] py-[var(--dimension-x4)]"
              role="status"
              aria-live="polite"
              aria-labelledby="decision-state-title"
            >
              <p className="m-0 text-[length:var(--type-section)] font-bold leading-6 text-[var(--fg-warning)]">결정 필요</p>
              <h2
                id="decision-state-title"
                className="m-0 mt-1 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]"
              >
                최소 인원까지 {Math.max(minimumParticipants - currentParticipants, 0)}명이 부족해요
              </h2>
              <p className="m-0 mt-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
                오늘 오후 6:30까지 진행 여부를 정해 주세요.
              </p>
            </section>

            <div className="px-[var(--dimension-x5)] pb-8 pt-6">
              <section
                className="rounded-[12px] bg-[var(--bg-neutral-weak)] p-4"
                aria-labelledby="participant-count-title"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3
                    id="participant-count-title"
                    className="m-0 font-display text-[length:var(--type-section)] font-normal leading-6 text-[var(--fg-neutral)]"
                  >
                    현재 {currentParticipants}명
                  </h3>
                  <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
                    최소 {minimumParticipants}명 · 정원 {capacity}명
                  </p>
                </div>
                <div
                  className="relative mt-4 h-4 rounded-full bg-[var(--stroke-neutral)]"
                  role="progressbar"
                  aria-label="모임 인원 현황"
                  aria-valuemin={0}
                  aria-valuemax={capacity}
                  aria-valuenow={Math.min(currentParticipants, capacity)}
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-[var(--fg-neutral)]"
                    style={{ width: `${Math.min((currentParticipants / capacity) * 100, 100)}%` }}
                  />
                  <span
                    className="absolute inset-y-[-3px] w-1 rounded-full bg-[var(--fg-neutral)]"
                    style={{ left: `${(minimumParticipants / capacity) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
              </section>

              <dl className="m-0 mt-6 border-b border-[var(--stroke-neutral)]">
                <div className="flex min-h-[74px] items-center gap-3 border-b border-[var(--stroke-neutral)]">
                  <Clock3
                    className="shrink-0 text-[var(--fg-warning)]"
                    size={28}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <dt className="m-0 font-display text-[length:var(--type-time)] font-normal leading-6 text-[var(--fg-neutral)]">
                      18분 남음
                    </dt>
                    <dd className="m-0 text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">오늘 오후 6:30까지 결정</dd>
                  </div>
                </div>
                <div className="flex min-h-[86px] items-center gap-3 border-b border-[var(--stroke-neutral)]">
                  <UsersRound
                    className="shrink-0 text-[var(--fg-muted)]"
                    size={28}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <dt className="m-0 text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">
                      진행하면 참가자에게 바로 알려요
                    </dt>
                    <dd className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">참가자는 체크인 전까지 취소할 수 있어요</dd>
                  </div>
                </div>
                <div className="flex min-h-[86px] items-center gap-3">
                  <ShieldCheck
                    className="shrink-0 text-[var(--fg-muted)]"
                    size={28}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <dt className="m-0 text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">
                      취소해도 출석 기록에 불이익이 없어요
                    </dt>
                    <dd className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">인원 미달로 취소해도 누구에게도 불이익이 없어요.</dd>
                  </div>
                </div>
              </dl>

              {!canProceed ? (
                <p className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]" role="note">
                  참가자가 2명 이상일 때만 현재 인원으로 진행할 수 있어요.
                </p>
              ) : null}
            </div>

            <BottomActionBar>
              <button
                ref={proceedTriggerRef}
                className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--stroke-neutral)] disabled:text-[var(--fg-muted)]"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={pendingAction === "proceed"}
                onClick={() => openConfirmation("proceed")}
                disabled={!canProceed}
              >
                {currentParticipants}명으로 진행하기
              </button>
              <button
                ref={cancelTriggerRef}
                className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-neutral)] ring-1 ring-inset ring-[var(--stroke-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={pendingAction === "cancel"}
                onClick={() => openConfirmation("cancel")}
              >
                인원 부족으로 취소하기
              </button>
            </BottomActionBar>
          </ScreenShell>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}

function QuorumDecisionFallback() {
  return (
    <ScreenShell bottomSpacing aria-label="최소 인원 미달 결정">
      <TopNavigation href="/" title="진행 여부 결정" />
      <div className="px-[var(--dimension-x5)] pb-8 pt-6">
        <h2 className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
          진행 여부를 확인하고 있어요
        </h2>
      </div>
    </ScreenShell>
  );
}

export default function QuorumDecisionPage() {
  return (
    <Suspense fallback={<QuorumDecisionFallback />}>
      <QuorumDecisionPageContent />
    </Suspense>
  );
}
