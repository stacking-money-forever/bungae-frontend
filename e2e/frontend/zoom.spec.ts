import { expect, egressViolations, isAllowedPageError, test } from "../fixtures/egress";
import type { Page } from "@playwright/test";

import { enlargeRenderedText, measureLayout } from "./layout-geometry";

/**
 * T06b zoom QA — 200% text zoom on the real production build (Chromium).
 *
 * Emulates the desktop accessibility zoom level behind text-only zoom
 * (deviceScaleFactor 1 keeps 1 CSS px = 1 physical px). Layout must stay
 * single-column with no horizontal scrolling at 200% text zoom: interactive
 * controls remain reachable within the viewport width.
 */

async function applyRealTextZoom(page: Page) {
  const result = await page.evaluate(enlargeRenderedText);
  expect(result.samples.length).toBeGreaterThan(0);
  for (const sample of result.samples) {
    expect(sample.after).toBeGreaterThan(sample.before * 1.9);
  }
}

async function assertZoomLayout(page: Page) {
  const layout = await page.evaluate(measureLayout);
  expect(layout.overflowing, JSON.stringify(layout.overflowing)).toEqual([]);
  expect(layout.intersections, JSON.stringify(layout.intersections)).toEqual([]);
}

test.describe("200% text zoom (chromium)", () => {
  test.use({ deviceScaleFactor: 1 });

  test("auth phone screen stays single-column with reachable primary action", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/auth", { waitUntil: "networkidle" });
    await applyRealTextZoom(page);

    const cta = page.getByRole("button", { name: "휴대전화로 시작하기" });
    await expect(cta).toBeVisible();

    await assertZoomLayout(page);

    // Vertical scroll reaches the CTA at 200% (expected); keyboard submit
    // still routes to the same local validation.
    await cta.scrollIntoViewIfNeeded();
    await cta.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "010-으로 시작하는" })).toBeVisible();

    expect(egressViolations(page)).toEqual([]);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });

  test("my-meetups anonymous recovery surface stays within the 390px viewport at 200%", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/my-meetups", { waitUntil: "networkidle" });
    await applyRealTextZoom(page);

    await expect(page.getByRole("heading", { name: "내 모임" })).toBeVisible();
    // Honest anonymous state: sign-in prompt (alert) renders, and the bottom
    // tab navigation (primary recovery) stays on screen.
    await expect(page.getByText("로그인한 뒤 내 모임을 확인해 주세요.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();

    await assertZoomLayout(page);

    expect(egressViolations(page)).toEqual([]);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });
});
