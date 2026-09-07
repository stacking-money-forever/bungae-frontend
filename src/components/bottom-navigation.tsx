"use client";

import { Bell, CalendarDays, Compass, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { NavigationLink } from "@/components/navigation-link";
import {
  dispatchTabGesture,
  getAdjacentTabDestination,
  getGestureAxis,
  shouldCommitHorizontalGesture,
  type GestureAxis,
} from "@/components/navigation-gestures";

export type BottomNavigationTab = "explore" | "my-meetups" | "notifications";

export interface BottomNavigationProps {
  activeTab: BottomNavigationTab;
}

type NavigationItem = {
  id: BottomNavigationTab;
  label: string;
  href: string;
  icon: LucideIcon;
};

const navigationItems: NavigationItem[] = [
  { id: "explore", label: "탐색", href: "/", icon: Compass },
  { id: "my-meetups", label: "내 모임", href: "/my-meetups", icon: CalendarDays },
  { id: "notifications", label: "알림", href: "/notifications", icon: Bell },
];

export function BottomNavigation({ activeTab }: BottomNavigationProps) {
  const reduceMotion = useReducedMotion();
  const pathname = usePathname() ?? "/";
  const gestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startedAt: number;
    axis: GestureAxis;
    deltaX: number;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const finishGesture = (pointerId: number, cancelled = false, clientX?: number) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== pointerId) return;
    if (!cancelled && typeof clientX === "number") {
      gesture.deltaX = clientX - gesture.startX;
    }

    const target = getAdjacentTabDestination(pathname, gesture.deltaX);
    const shouldCommit =
      !cancelled &&
      gesture.axis === "horizontal" &&
      target !== null &&
      shouldCommitHorizontalGesture(gesture.deltaX, performance.now() - gesture.startedAt);

    suppressClickRef.current = !cancelled && Math.abs(gesture.deltaX) >= 8;
    gestureRef.current = null;
    if (shouldCommit && target) {
      dispatchTabGesture({
        phase: "commit",
        direction: gesture.deltaX < 0 ? 1 : -1,
        target,
      });
    } else {
      dispatchTabGesture({ phase: "cancel" });
    }
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;
      gesture.deltaX = deltaX;
      if (gesture.axis === "pending") {
        gesture.axis = getGestureAxis(deltaX, deltaY);
      }
      if (gesture.axis === "horizontal") {
        const target = getAdjacentTabDestination(pathname, deltaX);
        dispatchTabGesture({ phase: "update", x: target ? deltaX * 0.72 : deltaX * 0.16 });
      }
    };
    const handlePointerUp = (event: PointerEvent) => finishGesture(event.pointerId, false, event.clientX);
    const handlePointerCancel = (event: PointerEvent) => finishGesture(event.pointerId, true, event.clientX);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  });

  return (
    <nav
      className="bottom-navigation"
      aria-label="주요 메뉴"
      data-no-page-swipe
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        gestureRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startedAt: performance.now(),
          axis: "pending",
          deltaX: 0,
        };
      }}
    >
      {navigationItems.map(({ id, label, href, icon: Icon }) => {
        const isActive = id === activeTab;

        return (
          <NavigationLink
            key={id}
            className="bottom-navigation__item"
            href={href}
            navigationIntent="tab"
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="bottom-navigation__icon" size={24} strokeWidth={1.8} aria-hidden="true" />
            <span className="bottom-navigation__label text-[12px] leading-4">{label}</span>
            {isActive ? (
              <motion.span
                layoutId="bottom-navigation-active-mark"
                className="bottom-navigation__active-mark"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }
                }
                aria-hidden="true"
              />
            ) : null}
          </NavigationLink>
        );
      })}
    </nav>
  );
}
