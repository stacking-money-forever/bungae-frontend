"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";

import { BottomNavigation, type BottomNavigationTab } from "@/components/bottom-navigation";

const tabPaths: Record<string, BottomNavigationTab> = {
  "/": "explore",
  "/filters": "explore",
  "/locations": "explore",
  "/my-meetups": "my-meetups",
  "/notifications": "notifications",
};

const standardEase = [0.2, 0.8, 0.2, 1] as const;

export function PersistentBottomNavigation() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const activeTab = pathname ? tabPaths[pathname] : undefined;
  const isFilterSheetRoute = pathname === "/filters" || pathname === "/locations";

  return (
    <AnimatePresence initial={false}>
      {activeTab ? (
        <motion.div
          key="persistent-bottom-navigation"
          className="fixed inset-x-0 bottom-0 z-10 mx-auto h-[76px] w-full max-w-[var(--screen-product-width)]"
          aria-hidden={isFilterSheetRoute ? true : undefined}
          inert={isFilterSheetRoute}
          initial={reduceMotion ? false : { y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.2, ease: standardEase }
          }
        >
          <BottomNavigation activeTab={activeTab} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
