import { defineConfig } from "@playwright/test";

/**
 * Component/route-view scenario harness (plan §8.3 face B). Reserved for
 * future test-only scenario entries; this pass ships no harness app because
 * a harness entry would import production UI and require product-adjacent
 * accommodation. The T06a requirement is owning this config and its script.
 *
 * Own isolated port 3121 and a separate report dir; never reuse the app-E2E
 * webServer (3120). A scenario app with a harness-specific build output and
 * injected typed adapters belongs here when a future task needs it.
 */

export default defineConfig({
  testDir: "./e2e/harness",
  outputDir: "./test-results/harness",
  snapshotDir: "./e2e/harness/screenshots",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "./test-results/harness-report", open: "never" }],
  ],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3121",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
