/**
 * Journey: Upgrade plan and invite a team member.
 */

import { test, expect } from "@playwright/test";

test.fixme(
  "owner can navigate to the upgrade / billing page",
  async ({ page }) => {
    // BLOCKER: Requires Stripe billing integration and a test-mode publishable key.
    await page.goto("/dashboard/settings/billing");
    await expect(page.getByRole("heading", { name: /billing|upgrade/i })).toBeVisible();
  },
);

test.fixme(
  "owner can start the upgrade flow to Pro",
  async ({ page }) => {
    // BLOCKER: Requires Stripe Checkout in test mode. Redirect to Stripe cannot
    // be completed in an automated test without a Stripe test-mode session.
    await page.goto("/dashboard/settings/billing");
    await page.getByRole("button", { name: /upgrade.*pro|choose pro/i }).click();
    // After clicking, the browser would redirect to Stripe Checkout.
    // We cannot automate the Stripe payment form — fixme here.
    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 10_000 });
  },
);

test.fixme(
  "owner can invite a member by email",
  async ({ page }) => {
    // BLOCKER: Requires live DB + invitation email delivery + Starter+ plan
    // (free plan allows only 1 member).
    await page.goto("/dashboard/settings/members");
    await page.getByRole("button", { name: /invite member|invite/i }).click();
    await page.getByLabel(/email/i).fill("invited@example.com");
    await page.getByRole("combobox", { name: /role/i }).selectOption("viewer");
    await page.getByRole("button", { name: /send invite|invite/i }).click();
    await expect(page.getByText(/invited@example.com/i)).toBeVisible();
  },
);
