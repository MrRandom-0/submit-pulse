/**
 * Playwright configuration for Submit Pulse end-to-end tests.
 *
 * The webServer block starts the Next.js dev server automatically when no
 * PLAYWRIGHT_BASE_URL is provided (local development). In CI the env var is
 * set to the staging deployment URL so no local server is required.
 */

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Retry once in CI to reduce flake noise. No retries locally.
  retries: process.env.CI ? 1 : 0,
  // 4 workers in CI; default (half of CPUs) locally.
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { open: "on-failure" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    // All tests run in a fresh browser context by default.
    // Tests that need persistence (e.g. login state) create named storage states.
  },
  projects: [
    // ── Setup project — runs auth flows and saves storage state ──────────────
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    // ── Chromium (primary) ───────────────────────────────────────────────────
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Reuse authenticated state produced by the setup project.
        storageState: "e2e/.auth/owner.json",
      },
      dependencies: ["setup"],
    },
  ],

  // Start the Next.js dev server when running locally (no BASE_URL set).
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },

  // Global timeout per test.
  timeout: 60_000,
  // Navigation / expect timeout.
  expect: { timeout: 10_000 },
});
