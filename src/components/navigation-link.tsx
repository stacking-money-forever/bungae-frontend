"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import {
  setNavigationIntent,
  type NavigationIntent,
} from "@/components/navigation-intent";

type LinkComponentProps = ComponentProps<typeof Link>;
type NavigationEvent = Parameters<NonNullable<LinkComponentProps["onNavigate"]>>[0];

export interface NavigationLinkProps extends Omit<LinkComponentProps, "onNavigate"> {
  navigationIntent: NavigationIntent;
  navigationTarget?: string;
  onNavigate?: (event: NavigationEvent) => void;
}

export function NavigationLink({
  navigationIntent,
  navigationTarget,
  onNavigate,
  href,
  ...props
}: NavigationLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      data-navigation-lifecycle="managed"
      onNavigate={(event) => {
        let isCancelled = false;
        const wrappedEvent: NavigationEvent = {
          preventDefault: () => {
            isCancelled = true;
            event.preventDefault();
          },
        };

        onNavigate?.(wrappedEvent);
        if (!isCancelled) {
          const target = navigationTarget ?? (typeof href === "string" ? href : null);
          if (target !== null) {
            setNavigationIntent(navigationIntent, target);
          }
        }
      }}
    />
  );
}
