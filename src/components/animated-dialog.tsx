"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

const standardEase = [0.2, 0.8, 0.2, 1] as const;
type DialogContentEventHandler = ComponentPropsWithoutRef<typeof Dialog.Content>["onOpenAutoFocus"];

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
  const contentPosition =
    placement === "center"
      ? "fixed inset-5 m-auto h-fit max-h-[calc(100svh-40px)]"
      : "fixed inset-x-5 bottom-[max(20px,env(safe-area-inset-bottom))] mx-auto max-h-[calc(100svh-40px)]";

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
                className={`${contentPosition} z-50 w-[calc(100%-40px)] max-w-[350px] overflow-y-auto rounded-[16px] bg-[var(--bg-layer-floating)] p-5 outline-none ${className ?? ""}`}
                initial={reduceMotion ? false : { opacity: 0, y: placement === "bottom" ? 24 : 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: placement === "bottom" ? 16 : 6, scale: 0.98 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: standardEase }}
              >
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
