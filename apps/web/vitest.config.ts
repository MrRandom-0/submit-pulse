import { defineConfig } from "vitest/config";

// Unit tests for the web app live under src/. The e2e/ directory contains
// Playwright specs — those run via `pnpm test:e2e`, never under Vitest.
// Web currently ships no unit tests; passWithNoTests keeps `vitest run`
// wired correctly until the first one lands.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**"],
    passWithNoTests: true,
  },
});
