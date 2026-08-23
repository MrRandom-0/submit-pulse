/**
 * Tests that the scanner refuses SSRF-unsafe URLs via the shared SSRF guard.
 * These tests verify that analyzeUrl returns ssrfBlocked=true for private/
 * loopback/non-HTTPS URLs without making real network calls.
 */

import { describe, it, expect } from "vitest";
import { analyzeUrl } from "../analyze.js";
import type { PromptContext } from "@submitpulse/config";

// Minimal PromptContext fixture — real fields, no secrets (see security comment in integration-prompts.ts).
const CTX: PromptContext = {
  formName: "Test Form",
  publicFormId: "fm_test00000000000000000000",
  endpoint: "https://api.submitpulse.io/f/fm_test00000000000000000000",
  fields: [{ name: "email", type: "email", required: true }],
  allowedOrigin: "https://example.com",
  captchaEnabled: false,
  hasFileUpload: false,
  builder: "other",
};

describe("analyzeUrl — SSRF guard", () => {
  it("blocks HTTP (non-HTTPS) URLs", async () => {
    const result = await analyzeUrl("http://example.com/contact", CTX);
    expect(result.ssrfBlocked).toBe(true);
    expect(result.ssrfReason).toBe("SCHEME_NOT_HTTPS");
  });

  it("blocks localhost", async () => {
    const result = await analyzeUrl("https://localhost/contact", CTX);
    expect(result.ssrfBlocked).toBe(true);
    expect(result.ssrfReason).toBe("LOOPBACK");
  });

  it("blocks 127.0.0.1 (IPv4 loopback)", async () => {
    const result = await analyzeUrl("https://127.0.0.1/admin", CTX);
    expect(result.ssrfBlocked).toBe(true);
    expect(result.ssrfReason).toBe("LOOPBACK");
  });

  it("blocks 10.x.x.x (RFC 1918)", async () => {
    const result = await analyzeUrl("https://10.0.0.1/secret", CTX);
    expect(result.ssrfBlocked).toBe(true);
    expect(result.ssrfReason).toBe("PRIVATE_IP");
  });

  it("blocks 192.168.x.x (RFC 1918)", async () => {
    const result = await analyzeUrl("https://192.168.1.1/admin", CTX);
    expect(result.ssrfBlocked).toBe(true);
    expect(result.ssrfReason).toBe("PRIVATE_IP");
  });

  it("blocks 169.254.169.254 (cloud metadata)", async () => {
    const result = await analyzeUrl("https://169.254.169.254/latest/meta-data/", CTX);
    expect(result.ssrfBlocked).toBe(true);
    // Cloud metadata check fires before IP check
    expect(["CLOUD_METADATA", "LINK_LOCAL"]).toContain(result.ssrfReason);
  });

  it("blocks malformed/invalid URLs", async () => {
    const result = await analyzeUrl("not-a-url", CTX);
    expect(result.ssrfBlocked).toBe(true);
    expect(result.ssrfReason).toBe("INVALID_URL");
  });

  it("blocks file:// scheme", async () => {
    const result = await analyzeUrl("file:///etc/passwd", CTX);
    expect(result.ssrfBlocked).toBe(true);
    expect(result.ssrfReason).toBe("SCHEME_NOT_HTTPS");
  });
});
