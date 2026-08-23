/**
 * Journey: Sign up for a new account.
 *
 * Covers:
 *   - Navigate to /auth/signup
 *   - Fill email + password
 *   - Submit and reach the onboarding step
 */

import { test, expect } from "@playwright/test";

// All signup tests use a fresh, unauthenticated context (no storageState).
test.use({ storageState: { cookies: [], origins: [] } });

test("user can reach the sign-up form", async ({ page }) => {
  // BLOCKER: Requires live auth UI. Verifying the page renders correctly.
  await page.goto("/auth/signup");
  await expect(page.getByRole("heading", { name: /create.*account|sign up/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});

test.fixme(
  "new user can sign up and is redirected to onboarding",
  async ({ page }) => {
    // BLOCKER: Supabase Auth backend not wired; email confirmation flow
    // depends on real transactional email delivery in a test environment.
    await page.goto("/auth/signup");
    const unique = `e2e-${Date.now()}@submitpulse.test`;
    await page.getByLabel(/email/i).fill(unique);
    await page.getByLabel(/password/i).fill("StrongP@ssw0rd!");
    await page.getByRole("button", { name: /create account|sign up/i }).click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  },
);
