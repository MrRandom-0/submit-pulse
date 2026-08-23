import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/__tests__/**/*.test.ts"],
  },
  resolve: {
    // Ensure workspace packages resolve via their src/ exports directly.
    alias: {
      "@submitpulse/security/hash": new URL(
        "../../packages/security/src/hash.ts",
        import.meta.url,
      ).pathname,
      "@submitpulse/security/ssrf": new URL(
        "../../packages/security/src/ssrf.ts",
        import.meta.url,
      ).pathname,
      "@submitpulse/security/origin": new URL(
        "../../packages/security/src/origin.ts",
        import.meta.url,
      ).pathname,
      "@submitpulse/security/rate-limit": new URL(
        "../../packages/security/src/rate-limit.ts",
        import.meta.url,
      ).pathname,
      "@submitpulse/security/captcha": new URL(
        "../../packages/security/src/captcha.ts",
        import.meta.url,
      ).pathname,
      "@submitpulse/security/file-validation": new URL(
        "../../packages/security/src/file-validation.ts",
        import.meta.url,
      ).pathname,
      "@submitpulse/security": new URL(
        "../../packages/security/src/index.ts",
        import.meta.url,
      ).pathname,
      "@submitpulse/validation/schema-validator": new URL(
        "../../packages/validation/src/schema-validator.ts",
        import.meta.url,
      ).pathname,
      "@submitpulse/validation": new URL(
        "../../packages/validation/src/index.ts",
        import.meta.url,
      ).pathname,
      "@submitpulse/config/brand": new URL(
        "../../packages/config/src/brand.ts",
        import.meta.url,
      ).pathname,
    },
  },
});
