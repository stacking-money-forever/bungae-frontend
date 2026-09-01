import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor } from "@testing-library/react";
import { useReducedMotion } from "motion/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import FiltersPage from "@/app/filters/page";
import {
  AnimatedDialog,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import { BottomNavigation } from "@/components/bottom-navigation";
import { PageTransition } from "@/components/page-transition";
import { PersistentBottomNavigation } from "@/components/persistent-bottom-navigation";

const usePathname = vi.hoisted(() => vi.fn());
const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: routerPush }),
}));

function ReducedMotionProbe() {
  const reduceMotion = useReducedMotion();

  return <output data-testid="reduced-motion">{String(reduceMotion)}</output>;
}

function OpenDialog() {
  return (
    <AnimatedDialog open onOpenChange={vi.fn()}>
      <AnimatedDialogTitle>확인할까요?</AnimatedDialogTitle>
      <AnimatedDialogDescription>변경 결과를 확인해 주세요.</AnimatedDialogDescription>
      <button type="button">확인</button>
    </AnimatedDialog>
  );
}

describe("reduced motion integration", () => {
  beforeAll(() => {
    window.__setReducedMotionPreference(true);
  });

  beforeEach(() => {
    routerPush.mockReset();
    usePathname.mockReturnValue("/");
    window.history.replaceState({}, "", "/");
  });

  it("reads the device preference through Motion's actual useReducedMotion hook", () => {
    render(<ReducedMotionProbe />);

    expect(screen.getByTestId("reduced-motion")).toHaveTextContent("true");
  });

  it("removes route movement immediately when reduced motion is enabled", () => {
    const { container, rerender } = render(
      <PageTransition>
        <p>홈</p>
      </PageTransition>,
    );

    usePathname.mockReturnValue("/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세</p>
      </PageTransition>,
    );

    expect(container.querySelector(".route-transition")).toHaveStyle({
      transform: "none",
    });
  });

  it("opens filter and dialog surfaces without an entry jump", async () => {
    const { unmount: unmountFilter } = render(<FiltersPage />);
    expect(screen.getByRole("dialog", { name: "필터" })).toHaveStyle({
      transform: "none",
    });
    unmountFilter();

    render(<OpenDialog />);
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "확인할까요?" })).toHaveStyle({
        opacity: "1",
      });
    });
  });

  it("keeps persistent navigation and its active mark instantaneous", () => {
    usePathname.mockReturnValue("/my-meetups");
    const { container } = render(<PersistentBottomNavigation />);

    expect(container.querySelector(".fixed")).toHaveStyle({
      transform: "none",
    });
    expect(screen.getByRole("link", { name: "내 모임" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(document.querySelector(".bottom-navigation__active-mark")).toBeInTheDocument();
  });

  it("keeps the CSS reduced-motion guardrails for static motion", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".chat-content-reveal");
    expect(css).toContain(".bottom-navigation__active-mark");
    expect(css).toContain("transition: none;");
  });

  it("does not paint a neutral rectangle behind unsurfaced controls when pressed", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const defaultPressedRule = css.match(
      /:where\(a, button, summary, \[role="button"\]\):not\(:disabled\):active \{([^}]*)\}/,
    )?.[1];

    expect(defaultPressedRule).toContain("opacity: 0.72;");
    expect(defaultPressedRule).not.toContain("background-color");
    expect(css).toContain("background-color: var(--brand-accent-pressed);");
  });

  it("keeps the active mark available to the standalone navigation primitive", () => {
    render(<BottomNavigation activeTab="notifications" />);

    expect(screen.getByRole("link", { name: "알림" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(document.querySelector(".bottom-navigation__active-mark")).toBeInTheDocument();
  });
});
