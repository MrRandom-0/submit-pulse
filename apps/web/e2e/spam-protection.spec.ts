/**
 * Journey: Enable spam protection (Turnstile captcha + honeypot).
 */

import { test, expect } from "@playwright/test";

test.fixme(
  "owner can enable Turnstile spam protection on a form",
  async ({ page }) => {
    // BLOCKER: Requires live DB + Turnstile site-key configuration in settings.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /spam|security/i }).click();
    await page.getByRole("switch", { name: /captcha|turnstile/i }).click();
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByRole("switch", { name: /captcha|turnstile/i })).toBeChecked();
  },
);

test.fixme(
  "owner can enable and configure a honeypot field",
  async ({ page }) => {
    // BLOCKER: Requires live DB.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /spam|security/i }).click();
    await page.getByRole("switch", { name: /honeypot/i }).click();
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByRole("switch", { name: /honeypot/i })).toBeChecked();
  },
);
