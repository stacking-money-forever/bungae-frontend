import { expect, test } from "@playwright/test";

/**
 * T06a app E2E — PWA service-worker registration on the allowed face.
 *
 * The pwa-chromium project (this file) is the only one that allows service
 * workers. The rest of the suite blocks them so page-level egress
 * interception cannot be bypassed by a controlled worker scope.
 *
 * This face asserts only the client-side registration surface: the app must
 * register `/sw.js` and reach a non-failure lifecycle state. It does not
 * assert push delivery, FCM registration, or real-device install — those
 * remain external gates (EXCLUDED_API / DEVICE_EVIDENCE_PENDING).
 */

test.describe("service worker registration surface", () => {
  test("app registers its service worker and stays on the anonymous home", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // PwaRoot registers after hydration; wait for an active worker.
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {
        scope: registration.scope,
        active: registration.active?.state ?? null,
        controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      };
    });

    expect(state.active).toBe("activated");
    expect(state.scope).toBe("http://127.0.0.1:3120/");

    // Registration must not reload the page or leave the anonymous home.
    await expect(page.getByRole("heading", { name: "로그인 후 모임을 찾아볼 수 있어요" })).toBeVisible();
  });
});
