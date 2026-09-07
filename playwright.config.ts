import { defineConfig, devices } from "@playwright/test";

/**
 * No-API app E2E (T06a). The production build is served as-is; every test
 * runs in a fresh, egress-denied browser context (see e2e/fixtures/egress).
 * There is no mock/API/server double and no user credentials or storageState.
 *
 * Ports (each config owns its webServer and never reuses a sibling's or a
 * stray process's port): 3120 app E2E / 3121 harness
 * (playwright.harness.config.ts). A PWA-only offline face shares the app E2E
 * build server; it never registers service workers elsewhere.
 */

const PORT = 3120;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e/frontend",
  outputDir: "./test-results/e2e",
  snapshotDir: "./e2e/screenshots",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "./test-results/e2e-report", open: "never" }],
  ],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3120",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /pwa[-.]?.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "webkit",
      testIgnore: /pwa[-.]?.*\.spec\.ts/,
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "firefox",
      testIgnore: /pwa[-.]?.*\.spec\.ts/,
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "pwa-chromium",
      testMatch: /pwa[-.]?.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        // Service-worker registration is exercised on this face only so the
        // page-level request interception in other faces cannot be bypassed.
        serviceWorkers: "allow",
      },
    },
  ],
});
