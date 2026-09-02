"use client";

import { ShieldCheck, UsersRound } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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

interface QuorumUpdateConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onExitComplete: () => void;
}

function parseParticipants(value: string | null | undefined) {
  if (value === null || value === undefined || value.trim() === "") {
    return 2;
  }

  const requestedCount = Number(value);
  return Number.isInteger(requestedCount) && requestedCount >= 0
    ? requestedCount
    : 2;
}

function QuorumUpdateConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  onExitComplete,
}: QuorumUpdateConfirmationDialogProps) {
  return (
    <AnimatedDialog
      open={open}
      onOpenChange={onOpenChange}
      onExitComplete={onExitComplete}
      onCloseAutoFocus={(event) => event.preventDefault()}
    >
      <AnimatedDialogTitle
        className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]"
      >
        참여를 취소할까요?
      </AnimatedDialogTitle>
      <AnimatedDialogDescription
        className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]"
      >
        체크인 시작 전 취소라 출석 신뢰에 불이익이 없어요.
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
          취소하기
        </button>
      </div>
    </AnimatedDialog>
  );
}

function QuorumUpdatePageContent() {
  const { meetupId } = useParams<{ meetupId: string }>();
  const searchParams = useSearchParams();
  const encodedMeetupId = encodeURIComponent(meetupId ?? "han-river-walk");
  const meetupPath = `/meetups/${encodedMeetupId}`;
  const currentParticipants = parseParticipants(searchParams?.get("participants"));
  const [pendingCancel, setPendingCancel] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const cancelTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingCancelCommitRef = useRef(false);
  const cancelWasOpenedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const resultTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.16, ease: "easeOut" as const };

  useEffect(() => {
    if (cancelled) {
      document.getElementById("quorum-update-cancelled-result")?.focus();
    }
  }, [cancelled]);

  function openCancelConfirmation() {
    cancelWasOpenedRef.current = true;
    setPendingCancel(true);
  }

  function confirmCancel() {
    if (!pendingCancel || pendingCancelCommitRef.current) {
      return;
    }

    pendingCancelCommitRef.current = true;
    setPendingCancel(false);
  }

  function handleDialogExitComplete() {
    if (pendingCancelCommitRef.current) {
      pendingCancelCommitRef.current = false;
      cancelWasOpenedRef.current = false;
      setCancelled(true);
      return;
    }

    if (cancelWasOpenedRef.current) {
      cancelWasOpenedRef.current = false;
      cancelTriggerRef.current?.focus();
    }
  }

  return (
    <>
      <QuorumUpdateConfirmationDialog
        open={pendingCancel}
        onOpenChange={(open) => {
          if (open) {
            cancelWasOpenedRef.current = true;
          }
          setPendingCancel(open);
        }}
        onConfirm={confirmCancel}
        onExitComplete={handleDialogExitComplete}
      />
      <AnimatePresence initial={false} mode="wait">
        {cancelled ? (
          <motion.div
            key="cancelled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={resultTransition}
            onAnimationComplete={() => {
              document.getElementById("quorum-update-cancelled-result")?.focus();
            }}
          >
          <ScreenShell bottomSpacing aria-label="모임 참여 취소 완료">
            <TopNavigation href={meetupPath} title="모임 진행 안내" />
            <ResultSection
              id="quorum-update-cancelled-result"
              tabIndex={-1}
              className="px-[var(--dimension-x5)] pb-8 pt-12"
              tone="neutral"
              heading="참여를 취소했어요"
              description="체크인 시작 전 취소라 출석 신뢰에 불이익이 없어요."
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
          key="active"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={resultTransition}
        >
          <ScreenShell bottomSpacing aria-label="모임 진행 안내">
            <TopNavigation href={meetupPath} title="모임 진행 안내" />

            <div className="px-[var(--dimension-x5)] pb-8 pt-7">
              <div
                className="flex size-[72px] items-center justify-center rounded-full bg-[var(--bg-neutral-weak)] text-[var(--fg-neutral)]"
                aria-hidden="true"
              >
                <UsersRound size={36} strokeWidth={1.8} />
              </div>
              <h2
                className="m-0 mt-9 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]"
                id="quorum-update-title"
              >
                {currentParticipants}명으로 진행해요
              </h2>
              <p className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
                체크인 시작 전까지 참여 여부를 직접 선택할 수 있어요.
              </p>

              <dl className="m-0 mt-7 rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-3" aria-label="모임 진행 정보">
                <div className="grid min-h-[48px] grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                  <dt className="text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">현재 인원</dt>
                  <dd className="m-0 text-right text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">
                    {currentParticipants}명 · 최소 3명
                  </dd>
                </div>
                <div className="grid min-h-[48px] grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                  <dt className="text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">시작</dt>
                  <dd className="m-0 text-right font-display text-[length:var(--type-time)] font-normal leading-6 text-[var(--fg-neutral)]">
                    오늘 오후 7:00
                  </dd>
                </div>
                <div className="grid min-h-[48px] grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                  <dt className="text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">취소 가능</dt>
                  <dd className="m-0 text-right text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">
                    오후 6:30 체크인 시작 전까지
                  </dd>
                </div>
              </dl>

              <div className="mt-7 flex min-h-[56px] items-center gap-3 text-[length:var(--type-section)] font-bold leading-6 text-[var(--fg-positive)]">
                <ShieldCheck className="shrink-0" size={28} strokeWidth={1.8} aria-hidden="true" />
                <p className="m-0">체크인 시작 전 취소하면 출석 신뢰에 불이익이 없어요.</p>
              </div>
            </div>

            <BottomActionBar>
              <a
                className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                href={`/meetups/${encodedMeetupId}/hub?confirmed=1`}
              >
                계속 참여하기
              </a>
              <button
                ref={cancelTriggerRef}
                className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-neutral)] ring-1 ring-inset ring-[var(--stroke-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={pendingCancel}
                onClick={openCancelConfirmation}
              >
                불이익 없이 취소하기
              </button>
            </BottomActionBar>
          </ScreenShell>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}

function QuorumUpdateFallback() {
  return (
    <ScreenShell bottomSpacing aria-label="모임 진행 안내">
      <TopNavigation href="/" title="모임 진행 안내" />
      <div className="px-[var(--dimension-x5)] pb-8 pt-6">
        <h2 className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
          모임 진행 정보를 확인하고 있어요
        </h2>
      </div>
    </ScreenShell>
  );
}

export default function QuorumUpdatePage() {
  return (
    <Suspense fallback={<QuorumUpdateFallback />}>
      <QuorumUpdatePageContent />
    </Suspense>
  );
}
