/**
 * Vitest workspace configuration — aggregates all package-level test configs.
 *
 * Each package/app defines its own vitest.config.ts. This workspace file
 * ensures `pnpm turbo run test` (which calls vitest --workspace) discovers
 * all of them without requiring per-package turbo tasks.
 *
 * New packages: add a glob entry here when adding a vitest.config.ts.
 */

import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  // Ingest worker unit tests (Cloudflare Worker environment).
  "apps/ingest/vitest.config.ts",

  // Package-level unit tests (standard Node environment).
  // Add an entry for each package that ships a vitest.config.ts.
  // Currently defined inline here so they can share the workspace
  // resolver config without duplicating it in each package.
  {
    test: {
      name: "packages",
      environment: "node",
      globals: false,
      include: [
        "packages/*/src/**/*.test.ts",
        "packages/*/src/__tests__/**/*.test.ts",
      ],
      exclude: [
        // The testing package itself has no tests — it exports helpers.
        "packages/testing/**",
        // Exclude e2e specs — those run via Playwright, not Vitest.
        "apps/web/e2e/**",
      ],
    },
    resolve: {
      alias: {
        "@submitpulse/auth/permissions": new URL(
          "packages/auth/src/permissions.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/config/entitlements": new URL(
          "packages/config/src/entitlements.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/config/brand": new URL(
          "packages/config/src/brand.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/config": new URL(
          "packages/config/src/index.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/security/ssrf": new URL(
          "packages/security/src/ssrf.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/security/origin": new URL(
          "packages/security/src/origin.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/security/rate-limit": new URL(
          "packages/security/src/rate-limit.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/security/file-validation": new URL(
          "packages/security/src/file-validation.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/security/hash": new URL(
          "packages/security/src/hash.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/security": new URL(
          "packages/security/src/index.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/webhooks/signing": new URL(
          "packages/webhooks/src/signing.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/webhooks/retry": new URL(
          "packages/webhooks/src/retry.ts",
          import.meta.url,
        ).pathname,
        "@submitpulse/testing": new URL(
          "packages/testing/src/index.ts",
          import.meta.url,
        ).pathname,
      },
    },
  },
]);
