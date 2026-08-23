/**
 * Journey: Create a form, copy the endpoint, submit a test submission,
 * and receive it in the inbox.
 */

import { test, expect } from "@playwright/test";

test.fixme(
  "owner can create a form",
  async ({ page }) => {
    // BLOCKER: Form creation server action + live DB required.
    await page.goto("/dashboard/forms");
    await page.getByRole("button", { name: /new form|create form/i }).click();
    await page.getByLabel(/form name/i).fill("E2E Contact Form");
    await page.getByRole("button", { name: /create/i }).click();
    await expect(page.getByText(/E2E Contact Form/i)).toBeVisible();
  },
);

test.fixme(
  "owner can copy the form endpoint URL",
  async ({ page }) => {
    // BLOCKER: Requires a created form to exist; depends on form creation journey.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    // The "Copy endpoint" button should write to the clipboard.
    await page.getByRole("button", { name: /copy endpoint|copy url/i }).click();
    await expect(page.getByText(/copied/i)).toBeVisible();
  },
);

test.fixme(
  "owner can submit a test submission via the form settings",
  async ({ page }) => {
    // BLOCKER: Requires live ingest worker + form to be active.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("button", { name: /test submission|send test/i }).click();
    // After test submission the inbox should reflect it.
    await expect(page.getByText(/submission received|test submission/i)).toBeVisible({
      timeout: 15_000,
    });
  },
);

test.fixme(
  "owner can see incoming submission in the inbox",
  async ({ page }) => {
    // BLOCKER: Requires live ingest + worker queue processing.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /submissions|inbox/i }).click();
    await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 15_000 });
  },
);
