/**
 * Journey: Export submission data and delete account.
 */

import { test, expect } from "@playwright/test";

test.fixme(
  "owner can export all workspace submissions as CSV",
  async ({ page }) => {
    // BLOCKER: Requires live DB with at least one submission and the export
    // server action implemented. The downloaded file cannot be verified
    // without a real browser download interception.
    await page.goto("/dashboard/settings");
    await page.getByRole("link", { name: /data.*export|export data/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export.*csv|download/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  },
);

test.fixme(
  "owner can initiate account deletion and is shown a confirmation",
  async ({ page }) => {
    // BLOCKER: Account deletion is a destructive action that would invalidate
    // the test user. Only safe to run in an isolated disposable account.
    // Requires the deletion server action and a separate test user provisioning
    // flow.
    await page.goto("/dashboard/settings/account");
    await page.getByRole("button", { name: /delete account/i }).click();
    await expect(
      page.getByRole("dialog", { name: /delete account|confirm deletion/i }),
    ).toBeVisible();
    // Do NOT confirm deletion in this test — we just verify the dialog appears.
  },
);
