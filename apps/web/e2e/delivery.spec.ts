/**
 * Journey: Configure email notifications and a webhook endpoint.
 */

import { test, expect } from "@playwright/test";

test.fixme(
  "owner can configure an email notification destination",
  async ({ page }) => {
    // BLOCKER: Requires live DB + email destination server action.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /notifications|email/i }).click();
    await page.getByRole("button", { name: /add email|add destination/i }).click();
    await page.getByLabel(/email address/i).fill("notify@example.com");
    await page.getByRole("button", { name: /save|add/i }).click();
    await expect(page.getByText(/notify@example.com/i)).toBeVisible();
  },
);

test.fixme(
  "owner can configure a webhook endpoint",
  async ({ page }) => {
    // BLOCKER: Requires live DB + webhook endpoint server action + Starter+ plan.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /webhooks/i }).click();
    await page.getByRole("button", { name: /add webhook|new webhook/i }).click();
    await page.getByLabel(/webhook url/i).fill("https://webhook.site/test-e2e");
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(page.getByText(/webhook.site/i)).toBeVisible();
  },
);
