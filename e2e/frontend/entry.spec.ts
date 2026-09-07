import { expect, isAllowedPageError, test } from "../fixtures/egress";

/**
 * T06a app E2E — filters sheet flow and direct-URL recovery.
 *
 * The filter surface is local-only (draft/apply/cancel, focus, query
 * serialization) and must work with no API egress. Applying a filter
 * navigates back home and serializes only allowed public values.
 */

test.describe("filters sheet flow", () => {
  test("draft edit, apply serializes the chosen filter, focus returns to first control", async ({ page }) => {
    await page.goto("/filters", { waitUntil: "networkidle" });

    const activity = page.getByRole("combobox", { name: "활동 필터" });
    await expect(activity).toBeVisible();
    await activity.focus();
    await expect(activity).toBeFocused();

    // Time -> 오늘 저녁 (draft); the underlying home chrome behind the sheet
    // must not change until apply.
    const time = page.getByRole("combobox", { name: "시간 필터" });
    await time.selectOption({ label: "오늘 저녁" });

    const activityNow = await activity.inputValue();
    expect(activityNow).toBe("전체");

    // Apply: closes the sheet and navigates home with the serialized query.
    await page.getByRole("button", { name: "필터 적용" }).click();
    await expect(page).toHaveURL(/\/\?.*time=/);
    await expect(page.getByText("오늘 저녁 · 2km · 전체 비용")).toBeVisible();

    const violations = (page as unknown as { __egressViolations: Array<{ kind: string; url: string }> }).__egressViolations;
    expect(violations).toEqual([]);
  });

  test("reset restores defaults and Escape dismisses back home", async ({ page }) => {
    await page.goto("/filters?time=%EC%98%A4%EB%8A%98%20%EC%A0%80%EB%85%81", { waitUntil: "networkidle" });

    const time = page.getByRole("combobox", { name: "시간 필터" });
    await expect(time).toHaveValue("오늘 저녁");

    await page.getByRole("button", { name: "초기화" }).click();
    await expect(time).toHaveValue("24시간");

    // Cancel (Escape closes the sheet) returns home with the applied filter
    // state — the initial query's time filter is preserved on the home route.
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/\?.*time=/);
    await expect(page.getByText("오늘 저녁 · 2km · 전체 비용")).toBeVisible();
  });

  test("reload preserves the serialized filter query and focus returns", async ({ page }) => {
    await page.goto("/filters?time=%EC%98%A4%EB%8A%98%20%EC%A0%80%EB%85%81", { waitUntil: "networkidle" });

    await expect(page.getByRole("combobox", { name: "시간 필터" })).toHaveValue("오늘 저녁");
    const activity = page.getByRole("combobox", { name: "활동 필터" });
    await expect(activity).toBeFocused();
  });
});

test.describe("direct URL entry states", () => {
  test("unknown route renders the not-found recovery surface", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/definitely-not-a-route", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "찾을 수 없는 화면이에요" })).toBeVisible();
    await expect(page.getByRole("link", { name: "벙개 홈으로" })).toBeVisible();
    await expect(page.getByRole("link", { name: "내 모임 보기" })).toBeVisible();
    await expect(page.getByRole("link", { name: "로그인하기" })).toBeVisible();

    // The recovery links must actually work from the not-found page.
    await page.getByRole("link", { name: "벙개 홈으로" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "로그인 후 모임을 찾아볼 수 있어요" })).toBeVisible();

    expect(pageErrors.filter((text) => !isAllowedPageError(text))).toEqual([]);
  });

  test("meetup detail direct entry is an anonymous sign-in recovery surface", async ({ page }) => {
    await page.goto("/meetups/unknown-meetup", { waitUntil: "networkidle" });

    // Anonymous detail has no server read; it is an honest login prompt.
    await expect(page.getByRole("heading", { name: "로그인하고 모임을 확인해 주세요" })).toBeVisible();
    await expect(page.getByRole("link", { name: "휴대전화로 로그인하기" })).toBeVisible();

    // No data rows/detail fabricated for a meetup id nobody authenticated for.
    await expect(page.getByRole("link", { name: /모임\s*\d+개/ })).toHaveCount(0);
    await expect(page.getByText(/현재\s*\d+명/)).toHaveCount(0);
  });

  test("connection detail is an honest unavailable surface with recovery", async ({ page }) => {
    await page.goto("/connections/c-123", { waitUntil: "networkidle" });

    // The connection detail contract is not implemented; the UI must state
    // that clearly and offer recovery, never a fabricated counterpart.
    await expect(page.getByRole("heading", { name: "연결 상세를 확인할 수 없어요" })).toBeVisible();
    await expect(page.getByRole("link", { name: "연결 목록으로" })).toBeVisible();
    await expect(page.getByRole("link", { name: "홈으로" })).toBeVisible();
    await expect(page.getByText(/메시지 보내기는 아직 제공되지 않아요/)).toBeVisible();
  });
});
