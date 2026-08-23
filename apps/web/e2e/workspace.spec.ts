/**
 * Journey: Create a workspace.
 *
 * Prerequisite: authenticated owner (storage state from auth.setup.ts).
 */

import { test, expect } from "@playwright/test";

test.fixme(
  "owner can create a new workspace",
  async ({ page }) => {
    // BLOCKER: Requires workspace creation server action and live DB.
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /new workspace|create workspace/i }).click();
    await page.getByLabel(/workspace name/i).fill("E2E Test Workspace");
    await page.getByLabel(/slug/i).fill(`e2e-ws-${Date.now()}`);
    await page.getByRole("button", { name: /create/i }).click();
    await expect(page.getByText(/workspace created|E2E Test Workspace/i)).toBeVisible();
  },
);
