"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

const standardEase = [0.2, 0.8, 0.2, 1] as const;
const sheetEase = [0.22, 1, 0.36, 1] as const;
type DialogContentEventHandler = ComponentPropsWithoutRef<typeof Dialog.Content>["onOpenAutoFocus"];

export function getDialogMotionStates(
  placement: "center" | "bottom",
  reduceMotion: boolean | null,
) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0 },
    };
  }

  if (placement === "bottom") {
    return {
      initial: { opacity: 1, y: "100%", scale: 1 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 1, y: "100%", scale: 1 },
      transition: { type: "tween" as const, duration: 0.28, ease: sheetEase },
    };
  }

  return {
    initial: { opacity: 0, y: 8, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 6, scale: 0.98 },
    transition: { duration: 0.18, ease: standardEase },
  };
}

export interface AnimatedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  trigger?: ReactElement;
  placement?: "center" | "bottom";
  className?: string;
  onExitComplete?: () => void;
  onOpenAutoFocus?: DialogContentEventHandler;
  onCloseAutoFocus?: DialogContentEventHandler;
}

export function AnimatedDialog({
  open,
  onOpenChange,
  children,
  trigger,
  placement = "bottom",
  className,
  onExitComplete,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: AnimatedDialogProps) {
  const reduceMotion = useReducedMotion();
  const motionStates = getDialogMotionStates(placement, reduceMotion);
  const contentPosition =
    placement === "center"
      ? "fixed inset-5 m-auto h-fit max-h-[calc(100svh-40px)]"
      : "fixed inset-x-0 bottom-0 mx-auto max-h-[calc(100svh-16px)]";
  const contentShape =
    placement === "center"
      ? "w-[calc(100%-40px)] max-w-[350px] rounded-[16px] p-5"
      : "w-full max-w-[var(--screen-product-width)] rounded-t-[24px] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <AnimatePresence onExitComplete={onExitComplete}>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay forceMount asChild>
              <motion.div
                className="fixed inset-0 z-40 bg-[var(--fg-neutral)]"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 0.2 }}
                exit={{ opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              forceMount
              asChild
              onOpenAutoFocus={onOpenAutoFocus}
              onCloseAutoFocus={onCloseAutoFocus}
            >
              <motion.section
                className={`${contentPosition} ${contentShape} z-50 overflow-y-auto bg-[var(--bg-layer-floating)] outline-none ${className ?? ""}`}
                aria-modal="true"
                initial={motionStates.initial}
                animate={motionStates.animate}
                exit={motionStates.exit}
                transition={motionStates.transition}
              >
                {placement === "bottom" ? (
                  <span
                    className="mx-auto mb-4 block h-1 w-12 shrink-0 rounded-full bg-[var(--stroke-neutral)]"
                    aria-hidden="true"
                  />
                ) : null}
                {children}
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export const AnimatedDialogTitle = Dialog.Title;
export const AnimatedDialogDescription = Dialog.Description;
export const AnimatedDialogClose = Dialog.Close;
