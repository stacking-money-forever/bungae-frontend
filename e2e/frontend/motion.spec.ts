import { expect, egressViolations, isAllowedPageError, test } from "../fixtures/egress";
import type { Page } from "@playwright/test";

/**
 * T06b reduced-motion QA on the real production build (reduce contexts).
 *
 * With prefers-reduced-motion: reduce the app must (1) disable the global
 * interactive transitions and reveal animations declared in globals.css and
 * (2) collapse motion components to zero-duration transitions. Checks read
 * computed styles in the page (real CSS), never animation timers.
 */

type TransitionStats = {
  transitioning: Array<{ tag: string; prop: string; duration: string }>;
  animated: number;
};

function readTransitionStats(): TransitionStats {
  const transitioning: Array<{ tag: string; prop: string; duration: string }> = [];
  let animated = 0;
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const cs = getComputedStyle(el);
    const isAnimating = cs.animationName !== "none" && cs.animationDuration !== "0s";
    const transitionDuration = parseFloat(cs.transitionDuration) || 0;
    const hasTransition = transitionDuration > 0 && cs.transitionProperty !== "none";
    if (isAnimating) animated += 1;
    if (hasTransition) {
      transitioning.push({ tag: el.tagName.toLowerCase(), prop: cs.transitionProperty, duration: cs.transitionDuration });
    }
  }
  return { transitioning, animated };
}

function readRevealState(): { name: string; duration: string } {
  // The reveal animation applies to .result-section > :first-child.
  const probe = document.createElement("div");
  probe.className = "result-section";
  const first = document.createElement("p");
  probe.appendChild(first);
  document.body.appendChild(probe);
  const cs = getComputedStyle(first);
  const state = { name: cs.animationName, duration: cs.animationDuration };
  probe.remove();
  return state;
}

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("interactive transitions and reveal animations are disabled under reduce", async ({ page }: { page: Page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "로그인 후 모임을 찾아볼 수 있어요" })).toBeVisible();

    const stats = await page.evaluate(readTransitionStats);
    // Global interactive transitions (a/button/summary/label:has(input))
    // are disabled by the reduce media rule in globals.css.
    expect(stats.transitioning, JSON.stringify(stats.transitioning)).toEqual([]);

    const reveal = await page.evaluate(readRevealState);
    expect(reveal.duration).toBe("0s");

    // The active-mark motion component must run with a zero-duration
    // transition under reduce (bottom-navigation reads useReducedMotion).
    const mark = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "bottom-navigation__active-mark";
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const result = { duration: cs.transitionDuration, property: cs.transitionProperty };
      probe.remove();
      return result;
    });
    expect(mark.duration).toBe("0s");

    expect(egressViolations(page)).toEqual([]);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });

  test("navigation completes and active-tab presentation lands under reduce", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/my-meetups", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "내 모임" })).toBeVisible();
    const originRow = page.locator(".bottom-navigation__item[aria-current='page']");
    await expect(originRow).toBeVisible();
    const originLabel = (await originRow.innerText()).trim();

    await page.getByRole("link", { name: "탐색" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "로그인 후 모임을 찾아볼 수 있어요" })).toBeVisible();

    // The active mark now belongs to the 탐색 tab — presentation landed.
    const nextRow = page.locator(".bottom-navigation__item[aria-current='page']");
    await expect(nextRow).toBeVisible();
    await expect(nextRow).toContainText("탐색");
    expect((await nextRow.innerText()).trim()).not.toBe(originLabel);

    expect(egressViolations(page)).toEqual([]);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });
});

test.describe("motion preference control (no-preference)", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("interactive transitions exist without reduce, proving the reduce assertions are non-vacuous", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "로그인 후 모임을 찾아볼 수 있어요" })).toBeVisible();

    const stats = await page.evaluate(readTransitionStats);
    // Without the reduce rule, interactive controls carry a real
    // background-color/color/opacity transition (globals.css base rule).
    const interactive = stats.transitioning.filter((entry) => ["a", "button", "summary"].includes(entry.tag));
    expect(interactive.length).toBeGreaterThan(0);

    const reveal = await page.evaluate(readRevealState);
    expect(reveal.duration).not.toBe("0s");

    expect(egressViolations(page)).toEqual([]);
  });
});
