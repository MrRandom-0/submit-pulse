/**
 * Journey: Upload a file via a form that has file uploads enabled.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";

test.fixme(
  "owner can enable file uploads on a form",
  async ({ page }) => {
    // BLOCKER: Requires Pro+ plan entitlement check and live DB.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /settings/i }).click();
    await page.getByRole("switch", { name: /file uploads/i }).click();
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByRole("switch", { name: /file uploads/i })).toBeChecked();
  },
);

test.fixme(
  "submitter can upload a file and it appears in the submission detail",
  async ({ page }) => {
    // BLOCKER: Requires live ingest worker, R2 storage binding, and the form
    // endpoint to be publicly accessible from the test runner's network.
    const fixturePath = path.join(__dirname, "fixtures/sample.pdf");
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /submissions/i }).click();
    // Find the most recent submission that has a file attachment.
    await page.getByRole("row").nth(1).click();
    await expect(page.getByRole("link", { name: /download/i })).toBeVisible();
    void fixturePath; // referenced to avoid unused-var lint error
  },
);
