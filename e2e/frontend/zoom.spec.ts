import { expect, egressViolations, isAllowedPageError, test } from "../fixtures/egress";
import type { Page } from "@playwright/test";

/**
 * T06b zoom QA — 200% text zoom on the real production build (Chromium).
 *
 * Emulates the desktop accessibility zoom level behind text-only zoom
 * (deviceScaleFactor 1 keeps 1 CSS px = 1 physical px). Layout must stay
 * single-column with no horizontal scrolling at 200% text zoom: interactive
 * controls remain reachable within the viewport width.
 */

type ZoomState = {
  viewportWidth: number;
  bodyScrollWidth: number;
  overflowing: Array<{ tag: string; cls: string; width: number }>;
  scrollableWidth: number;
};

function measureZoom(): ZoomState {
  const vw = Math.max(document.documentElement.clientWidth, window.innerWidth);
  const overflowing: Array<{ tag: string; cls: string; width: number }> = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (rect.width > vw + 0.5 && !/fixed|sticky/.test(cs.position) && cs.overflowX !== "hidden" && cs.overflowX !== "clip") {
      const cls = typeof el.className === "string" ? el.className : "";
      overflowing.push({ tag: el.tagName.toLowerCase(), cls: cls.slice(0, 90), width: Math.round(rect.width) });
    }
  }
  return {
    viewportWidth: vw,
    bodyScrollWidth: document.body?.getBoundingClientRect().width ?? document.documentElement.scrollWidth,
    overflowing,
    scrollableWidth: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

function zoomState(page: Page): Promise<ZoomState> {
  // Evaluated at call time; callers wait for their own assertions first.
  return page.evaluate(measureZoom);
}

function assertNoHorizontalScroll(state: ZoomState) {
  expect(state.overflowing, JSON.stringify(state.overflowing)).toEqual([]);
  expect(state.bodyScrollWidth).toBeLessThanOrEqual(state.viewportWidth + 0.5);
  expect(state.scrollableWidth).toBeLessThanOrEqual(0.5);
}

test.describe("200% text zoom (chromium)", () => {
  test.use({ deviceScaleFactor: 1 });

  test("auth phone screen stays single-column with reachable primary action", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/auth", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });

    const cta = page.getByRole("button", { name: "휴대전화로 시작하기" });
    await expect(cta).toBeVisible();

    assertNoHorizontalScroll(await zoomState(page));

    // Vertical scroll reaches the CTA at 200% (expected); keyboard submit
    // still routes to the same local validation.
    await cta.scrollIntoViewIfNeeded();
    await cta.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "국가 코드를 포함한" })).toBeVisible();

    expect(egressViolations(page)).toEqual([]);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });

  test("my-meetups anonymous recovery surface stays within the 390px viewport at 200%", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/my-meetups", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });

    await expect(page.getByRole("heading", { name: "내 모임" })).toBeVisible();
    // Honest anonymous state: sign-in prompt (alert) renders, and the bottom
    // tab navigation (primary recovery) stays on screen.
    await expect(page.getByText("로그인한 뒤 내 모임을 확인해 주세요.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();

    assertNoHorizontalScroll(await zoomState(page));

    expect(egressViolations(page)).toEqual([]);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });
});
