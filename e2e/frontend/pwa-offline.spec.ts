import { expect, test } from "@playwright/test";

/**
 * T06a app E2E — PWA offline navigation document (pwa-chromium face).
 *
 * The offline fallback is produced by the service-worker fetch handler, so
 * this spec runs only in the project that allows service workers. The
 * fallback must be the JS-free offline document with a retry link to the
 * exact attempted URL — never a cached authenticated/private page.
 */

test.describe("offline navigation document", () => {
  test("serves the offline document with retry and home escape when offline", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for the app-registered worker to control the page.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) throw new Error("no active service worker");
      if (!navigator.serviceWorker.controller) {
        // First load registers; claim() takes control — re-evaluate once ready.
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
        });
      }
    });

    // Take the network away and navigate to a deep path with query.
    await page.context().setOffline(true);
    await page
      .goto("/my-meetups?state=OPEN", { waitUntil: "domcontentloaded" })
      .catch(() => undefined);

    // The offline document is standalone and JS-free.
    await expect(page.locator("body")).toContainText("인터넷 연결이 필요해요");
    await expect(page.locator("main")).toContainText("다시 시도");

    // Retry link points at the exact attempted navigation.
    const retryHref = await page
      .locator("a", { hasText: "다시 시도" })
      .getAttribute("href");
    expect(retryHref).toContain("/my-meetups");
    expect(retryHref).toContain("state=OPEN");

    // The home escape is present.
    await expect(page.locator('a[href="/"]')).toBeVisible();
  });
});
