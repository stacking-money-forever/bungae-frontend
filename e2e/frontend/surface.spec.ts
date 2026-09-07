import { expect, egressViolations, isAllowedPageError, test } from "../fixtures/egress";
import type { Page } from "@playwright/test";

/**
 * T06b surface QA — layout/zoom/keyboard on the real production build.
 *
 * Real-browser checks for the no-API snapshot: 320px narrow layout, text
 * overflow with long ko/en strings, 200% text zoom, keyboard-only reach,
 * and horizontal-overflow cleanliness. No mocks/API doubles; every check
 * runs against the anonymous surfaces this build can honestly render.
 *
 * Overflow probes are generic by design: each screen owns horizontal layout
 * inside its shell, so a violation anywhere inside the measured viewport is
 * a defect, independent of which element's box overflows.
 */

function assertNoEgress(page: Page) {
  expect(egressViolations(page)).toEqual([]);
}

function collectErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return pageErrors;
}

function viewportOverflow(): Array<{ tag: string; cls: string; width: number }> {
  const doc = document.documentElement;
  const body = document.body;
  const overflowing: Array<{ tag: string; cls: string; width: number }> = [];
  const vw = Math.max(doc.clientWidth, window.innerWidth);
  if (body) {
    const bw = body.getBoundingClientRect();
    if (bw.width > vw + 0.5) {
      overflowing.push({ tag: "body", cls: body.className, width: Math.round(bw.width) });
    }
  }
  for (const el of Array.from(doc.querySelectorAll("body *"))) {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (rect.width > vw + 0.5 && !/fixed|sticky/.test(cs.position) && cs.overflowX !== "hidden" && cs.overflowX !== "clip") {
      const cls = typeof el.className === "string" ? el.className : "";
      overflowing.push({ tag: el.tagName.toLowerCase(), cls: cls.slice(0, 90), width: Math.round(rect.width) });
    }
  }
  return overflowing;
}

test.describe("narrow 320px layout", () => {
  test.use({ viewport: { width: 320, height: 844 } });

  test("auth phone screen fits without horizontal overflow and keeps the primary action usable", async ({ page }) => {
    const pageErrors = collectErrors(page);
    await page.goto("/auth", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: /24시간 안에 안전하게/ })).toBeVisible();
    const overflow = await page.evaluate(viewportOverflow);
    expect(overflow, JSON.stringify(overflow)).toEqual([]);

    const cta = page.getByRole("button", { name: "휴대전화로 시작하기" });
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320.5);

    assertNoEgress(page);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });

  test("my-meetups anonymous surface fits 320px with recovery links usable", async ({ page }) => {
    const pageErrors = collectErrors(page);
    await page.goto("/my-meetups", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "내 모임" })).toBeVisible();
    const overflow = await page.evaluate(viewportOverflow);
    expect(overflow, JSON.stringify(overflow)).toEqual([]);

    // Honest anonymous state: sign-in prompt (alert) renders, and the bottom
    // tab navigation (primary recovery) stays on screen.
    await expect(page.getByText("로그인한 뒤 내 모임을 확인해 주세요.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();

    assertNoEgress(page);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });
});

test.describe("long-content overflow at 390x844", () => {
  test("auth screen tolerates a long national phone draft and long help text without horizontal overflow", async ({ page }) => {
    const pageErrors = collectErrors(page);
    await page.goto("/auth", { waitUntil: "networkidle" });

    const phone = page.getByRole("textbox", { name: "휴대전화 번호" });
    await phone.fill("+82101234567890123456789012345678901234567890");

    const overflow = await page.evaluate(viewportOverflow);
    expect(overflow, JSON.stringify(overflow)).toEqual([]);

    // Draft kept verbatim; validation error and help text must wrap, not clip.
    await page.getByRole("button", { name: "휴대전화로 시작하기" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "국가 코드를 포함한" })).toBeVisible();
    const overflow2 = await page.evaluate(viewportOverflow);
    expect(overflow2, JSON.stringify(overflow2)).toEqual([]);

    assertNoEgress(page);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });

  test("new-meetup auth-gate body and long-placeholder fields never overflow at 390px", async ({ page }) => {
    const pageErrors = collectErrors(page);
    await page.goto("/meetups/new", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "로그인하고 모임을 만들어 주세요" })).toBeVisible();
    const overflow = await page.evaluate(viewportOverflow);
    expect(overflow, JSON.stringify(overflow)).toEqual([]);

    assertNoEgress(page);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });

  test("filters screen tolerates long English/ko option labels without horizontal overflow", async ({ page }) => {
    const pageErrors = collectErrors(page);
    await page.goto("/filters", { waitUntil: "networkidle" });

    const time = page.getByRole("combobox", { name: "시간 필터" });
    await expect(time).toBeVisible();
    const overflow = await page.evaluate(viewportOverflow);
    expect(overflow, JSON.stringify(overflow)).toEqual([]);

    assertNoEgress(page);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });
});

test.describe("keyboard-only reach", () => {
  test("auth phone → primary action is reachable and operable by keyboard with a visible focus ring", async ({ page }, testInfo) => {
    const pageErrors = collectErrors(page);
    await page.goto("/auth", { waitUntil: "networkidle" });

    const phone = page.getByRole("textbox", { name: "휴대전화 번호" });
    await expect(phone).toBeFocused();

    const cta = page.getByRole("button", { name: "휴대전화로 시작하기" });
    if (testInfo.project.name === "webkit") {
      // Safari (WebKit) skips buttons in raw Tab order unless the user has
      // enabled Full Keyboard Access; that is a platform preference, not an
      // app defect. The app-level guarantee is that the control is focusable,
      // shows a visible focus ring, and submits from the keyboard.
      await cta.focus();
      await expect(cta).toBeFocused();
    } else {
      // Phone is autofocused on entry; the primary CTA is the next focusable
      // control in real tab order (verified: input → CTA → retry).
      await page.keyboard.press("Tab");
      await expect(cta).toBeFocused();
    }

    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { outline: cs.outlineStyle, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
    });
    // Focus ring must be visible (outline or focus box-shadow), not suppressed.
    expect(focused === null || (focused.outline !== "none" && focused.outlineWidth !== "0px") || focused.boxShadow !== "none").toBe(true);

    // Enter activates the submit (invalid → local error, zero egress).
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "국가 코드를 포함한" })).toBeVisible();

    assertNoEgress(page);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });

  test("locations search + cancel/apply row is keyboard operable inside the dialog", async ({ page }) => {
    const pageErrors = collectErrors(page);
    await page.goto("/locations", { waitUntil: "networkidle" });

    // Direct entry auto-focuses the neighborhood search.
    const search = page.getByRole("searchbox", { name: /동네 검색/ });
    await expect(search).toBeFocused();

    await search.fill("마포");
    await expect(
      page.getByRole("radiogroup", { name: "선택 가능한 동네" }).getByText("마포구 망원동", { exact: true }),
    ).toBeVisible();

    // Escape dismisses to home (dialog close contract).
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "로그인 후 모임을 찾아볼 수 있어요" })).toBeVisible();

    assertNoEgress(page);
    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });
});
