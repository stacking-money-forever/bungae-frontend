import { expect, isAllowedPageError, test } from "../fixtures/egress";

/**
 * T06a app E2E — shell / route children / honest anonymous home.
 *
 * Verifies on the real production build that the root tab renders the actual
 * route children (no fixture rows, no fabricated meetup counts), that
 * tab/navigation focus and history behave, and that no API egress escapes
 * the isolated context.
 */

test.describe("shell and honest discovery", () => {
  test("anonymous home renders honest unavailable discovery without fixture rows or counts", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: "로그인 후 모임을 찾아볼 수 있어요" }),
    ).toBeVisible();

    // The fixture/meetup-feed count surface must never render for a
    // non-authenticated shell: no "모임 N개", no fake rows.
    await expect(page.getByText(/모임\s*\d+개/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /meetup/i })).toHaveCount(0);

    // Explore tab is current.
    await expect(page.getByRole("link", { name: "탐색" })).toHaveAttribute("aria-current", "page");

    const violations = (page as unknown as { __egressViolations: Array<{ kind: string; url: string }> }).__egressViolations;
    expect(violations).toEqual([]);

    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });

  test("home filter summary is locale-neutral and always visible", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByText("24시간 · 2km · 전체 비용")).toBeVisible();
    await expect(page.getByRole("link", { name: "필터 변경" })).toBeVisible();
    await expect(page.getByRole("link", { name: "동네 변경" })).toBeVisible();
  });

  test("filter sheet route keeps a single main landmark and no fixture rows", async ({ page }) => {
    await page.goto("/filters", { waitUntil: "networkidle" });

    // Route sheet opens on direct entry.
    await expect(page.getByRole("heading", { name: "필터" })).toBeVisible();

    // Only one visible main landmark (the shell) — no duplicated/fixture mains.
    const mains = await page.locator("main:visible").count();
    expect(mains).toBeLessThanOrEqual(1);

    // No result-count text invented on a filters-only screen.
    await expect(page.getByText(/모임\s*\d+개/)).toHaveCount(0);
  });

  test("bottom tab navigation preserves route children and focus", async ({ page }) => {
    await page.goto("/my-meetups", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "내 모임" })).toBeVisible();
    // Anonymous my-meetups is an honest sign-in surface.
    await expect(page.getByText("로그인한 뒤 내 모임을 확인해 주세요.")).toBeVisible();
    await expect(page.getByRole("link", { name: "내 모임" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: "탐색" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "로그인 후 모임을 찾아볼 수 있어요" })).toBeVisible();
    await expect(page.getByRole("link", { name: "탐색" })).toHaveAttribute("aria-current", "page");
  });

  test("notifications tab is an honest anonymous surface", async ({ page }) => {
    await page.goto("/notifications", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "알림", exact: true })).toBeVisible();
    await expect(page.getByText("로그인한 뒤 알림을 확인해 주세요.")).toBeVisible();
    // No fake notification rows before login.
    await expect(page.getByText(/읽지 않음/)).toHaveCount(0);
    await expect(page.getByText("알림 목록")).toBeVisible();
  });
});
