/**
 * Auth setup — runs before the main test projects.
 *
 * Performs the sign-up / sign-in flow once and saves the resulting browser
 * storage state so all other tests can reuse it without re-authenticating.
 *
 * BLOCKER: Requires a live Next.js + Supabase Auth backend.
 * Mark individual steps fixme until the auth backend is wired.
 */

import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const OWNER_STATE = path.join(__dirname, ".auth/owner.json");

// These credentials must exist in the test environment. In CI they come from
// repository secrets (PLAYWRIGHT_TEST_EMAIL, PLAYWRIGHT_TEST_PASSWORD).
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || "e2e-owner@submitpulse.test";
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || "changeme-not-real";

setup("authenticate as owner", async ({ page }) => {
  await page.goto("/auth/login");

  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for the redirect to the dashboard.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Persist storage state for downstream tests.
  await page.context().storageState({ path: OWNER_STATE });
});
