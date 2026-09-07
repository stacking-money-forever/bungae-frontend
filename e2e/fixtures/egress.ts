import { test as base, expect, type Page, type Route } from "@playwright/test";

/**
 * Egress-denied, production-app-only E2E harness.
 *
 * Contract (plan §8.3 face A):
 * - Serves the real Next production build untouched; no fixture/mock/API
 *   injection anywhere.
 * - Every test runs in a fresh context whose baseURL is the app E2E server.
 *   All browser egress is denied except same-origin UI resources
 *   (HTML/RSC/JS/CSS/static/font/manifest). `/v1/**` and `/api/**` calls and
 *   any third-party request fail loudly and are recorded as egress
 *   violations asserted by each test.
 * - Service workers are blocked on this face (the pwa-chromium project is the
 *   only `allow`), so page-level interception cannot be bypassed by a worker.
 * - Tests are anonymous by design: this build has no persisted session
 *   (in-memory auth store) and no credentials are ever supplied.
 */

/** Failure-handling for uncaught page errors / console errors. */
export function isAllowedPageError(text: string): boolean {
  // Next reports navigation aborts and RSC reconnect noise that are expected
  // in E2E; everything else is treated as a defect.
  if (text.includes("ERR_ABORTED")) return true;
  if (text.includes("net::ERR_FAILED")) return true;
  if (text.includes("Failed to fetch")) return true;
  if (text.includes("The connection was reset")) return true;
  return false;
}

type EgressViolation = { kind: "denied-api" | "denied-external"; url: string };

export const test = base.extend<{ page: Page }>({
  page: async ({ browser, contextOptions, viewport }, use) => {
    const projectUse = (test.info().project.use ?? {}) as { baseURL?: string };
    const baseURL = projectUse.baseURL ?? "http://127.0.0.1:3120";
    const origin = new URL(baseURL).origin;

    const context = await browser.newContext({
      // T06b probes opt in via test.use({ contextOptions: … }) — e.g.
      // reducedMotion: "reduce" for the reduced-motion describe. Resolved
      // per-test viewport/reducedMotion come from the `viewport`/`contextOptions`
      // fixture values, so project config and test.use() both apply.
      ...contextOptions,
      baseURL,
      viewport: viewport ?? { width: 390, height: 844 },
      serviceWorkers: "block",
    });

    const violations: EgressViolation[] = [];
    await context.route("**/*", async (route: Route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path.startsWith("/v1/") || path.startsWith("/api/")) {
        violations.push({ kind: "denied-api", url: route.request().url() });
        await route.abort("blockedbyclient");
        return;
      }
      if (url.origin === origin) {
        await route.continue();
        return;
      }
      violations.push({ kind: "denied-external", url: route.request().url() });
      await route.abort("blockedbyclient");
    });

    const page = await context.newPage();
    // Attach the live array up front so tests can assert zero egress at any
    // point; route handlers push into the same array throughout the test.
    (page as unknown as { __egressViolations: EgressViolation[] }).__egressViolations = violations;
    await use(page);
    await context.close();
  },
});

/**
 * Read the live egress-violation array the page fixture attaches up front.
 * The property is harness-owned; a missing array reads as zero violations.
 */
export function egressViolations(page: Page): EgressViolation[] {
  const withViolations = page as unknown as { __egressViolations?: EgressViolation[] };
  return withViolations.__egressViolations ?? [];
}

export { expect };
export type { EgressViolation };
