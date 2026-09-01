"use client";

import { Bell, CalendarDays, Compass, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { NavigationLink } from "@/components/navigation-link";

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

  return (
    <nav className="bottom-navigation" aria-label="주요 메뉴">
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
