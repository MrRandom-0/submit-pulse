/**
 * Journey: Enable Pulse Monitor, trigger a broken form, see the incident,
 * generate an AI repair prompt, and restore the integration.
 */

import { test, expect } from "@playwright/test";

test.fixme(
  "owner can enable Pulse Monitor for a form",
  async ({ page }) => {
    // BLOCKER: Requires Pro+ plan + live health check worker + DB.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /pulse|health/i }).click();
    await page.getByRole("switch", { name: /pulse monitor/i }).click();
    await page.getByLabel(/website url/i).fill("https://example.com/contact");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByRole("switch", { name: /pulse monitor/i })).toBeChecked();
  },
);

test.fixme(
  "incident is created when the health check detects a broken form",
  async ({ page }) => {
    // BLOCKER: Requires the health check worker to run a real HTTP probe
    // against a test page that serves a broken form. Not automatable without
    // the worker running and a controllable test page.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /pulse|health/i }).click();
    await expect(page.getByRole("alert", { name: /incident|down|broken/i })).toBeVisible({
      timeout: 30_000,
    });
  },
);

test.fixme(
  "owner can see the incident details page",
  async ({ page }) => {
    // BLOCKER: Requires an existing incident row in the DB.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /pulse|health/i }).click();
    await page.getByRole("link", { name: /view incident|details/i }).click();
    await expect(page.getByRole("heading", { name: /incident/i })).toBeVisible();
  },
);

test.fixme(
  "owner can generate an AI repair prompt for a broken integration",
  async ({ page }) => {
    // BLOCKER: Requires Pro+ plan + aiRepair feature + live incident + AI API key.
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /pulse|health/i }).click();
    await page.getByRole("link", { name: /view incident|details/i }).click();
    await page.getByRole("button", { name: /generate.*repair|ai repair/i }).click();
    await expect(page.getByRole("dialog", { name: /repair prompt|ai prompt/i })).toBeVisible();
    await expect(page.getByText(/copy prompt/i)).toBeVisible();
  },
);

test.fixme(
  "owner can restore the integration and mark the incident resolved",
  async ({ page }) => {
    // BLOCKER: Requires an existing incident + the health check to subsequently
    // succeed (requires a controllable test page).
    await page.goto("/dashboard/forms");
    await page.getByRole("link", { name: /E2E Contact Form/i }).click();
    await page.getByRole("tab", { name: /pulse|health/i }).click();
    await page.getByRole("link", { name: /view incident|details/i }).click();
    await page.getByRole("button", { name: /acknowledge|resolve/i }).click();
    await expect(page.getByText(/resolved|acknowledged/i)).toBeVisible();
  },
);
