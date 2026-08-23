/**
 * Integration prompt generator tests.
 * Run with: vitest
 *
 * SECURITY INVARIANT UNDER TEST: no generated prompt may contain a pattern
 * that looks like a secret credential (API key, token, etc.).
 */

import { describe, it, expect } from "vitest";
import {
  generateIntegrationPrompt,
  generateRepairPrompt,
  generateScannerFixPrompt,
  type PromptContext,
  type DriftEvidence,
  type ScannerIssue,
} from "../integration-prompts.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ENDPOINT = "https://api.submitpulse.com/v1/forms/fm_abc123/submissions";

const BASE_FIELDS = [
  { name: "email", type: "email", required: true, label: "Email address" },
  { name: "message", type: "textarea", required: true },
  { name: "newsletter", type: "checkbox", required: false },
] as const;

function makeCtx(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    formName: "Contact Us",
    publicFormId: "fm_abc123",
    endpoint: ENDPOINT,
    fields: [...BASE_FIELDS],
    allowedOrigin: "https://example.com",
    captchaEnabled: false,
    hasFileUpload: false,
    builder: "cursor",
    ...overrides,
  };
}

// Regex patterns that match common secret-looking tokens.
// These must NEVER appear in generated output.
const SECRET_PATTERNS = [
  /\bsk_[a-zA-Z0-9]{16,}\b/,          // Stripe-style live key
  /\bsubmitpulse_live_[a-zA-Z0-9]+\b/, // brand live key
  /\bsubmitpulse_test_[a-zA-Z0-9]+\b/, // brand test key
  /\bsubmitpulse_setup_[a-zA-Z0-9]+\b/,// brand setup/installation token
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/, // Bearer token in Authorization
  /Authorization:\s*["']?[A-Za-z0-9+/]{20,}["']?/, // raw Authorization header value
];

function assertNoSecrets(output: string, label: string): void {
  for (const pattern of SECRET_PATTERNS) {
    expect(
      pattern.test(output),
      `${label}: output matched secret pattern ${pattern.source}`,
    ).toBe(false);
  }
}

// ---------------------------------------------------------------------------
// generateIntegrationPrompt — coding builders
// ---------------------------------------------------------------------------

describe("generateIntegrationPrompt — cursor (ide_agent)", () => {
  const ctx = makeCtx({ builder: "cursor" });
  const output = generateIntegrationPrompt(ctx);

  it("contains the real endpoint URL", () => {
    expect(output).toContain(ENDPOINT);
  });

  it("contains every expected field name", () => {
    for (const field of BASE_FIELDS) {
      expect(output).toContain(field.name);
    }
  });

  it("never emits a secret-looking token", () => {
    assertNoSecrets(output, "cursor prompt");
  });

  it("includes all required sections", () => {
    expect(output).toContain("Endpoint");
    expect(output).toContain("Field schema");
    expect(output).toContain("Requirements");
    expect(output).toContain("Reference implementation");
  });

  it("mentions the allowed origin", () => {
    expect(output).toContain("https://example.com");
  });

  it("includes duplicate-submission prevention requirement", () => {
    expect(output).toContain("duplicate");
  });

  it("includes loading state requirement", () => {
    expect(output).toContain("loading state");
  });

  it("includes accessibility requirement", () => {
    expect(output).toContain("aria-invalid");
  });
});

describe("generateIntegrationPrompt — lovable (chat_agent, no envVars)", () => {
  const ctx = makeCtx({ builder: "lovable" });
  const output = generateIntegrationPrompt(ctx);

  it("contains the real endpoint URL", () => {
    expect(output).toContain(ENDPOINT);
  });

  it("states that no environment variable is needed", () => {
    expect(output).toMatch(/no environment variable|No environment variable/i);
  });

  it("appends Lovable-specific caveat", () => {
    // Lovable caveat mentions regeneration.
    expect(output).toContain("regenerates");
  });

  it("never emits a secret-looking token", () => {
    assertNoSecrets(output, "lovable prompt");
  });
});

describe("generateIntegrationPrompt — v0 (understandsRepoWideInstruction: false)", () => {
  const ctx = makeCtx({ builder: "v0" });
  const output = generateIntegrationPrompt(ctx);

  it("explicitly instructs the user to open the target file/component", () => {
    // When understandsRepoWideInstruction is false, the prompt must name
    // the target and explain the agent only sees the open file.
    expect(output).toMatch(/open the component|open.*file|currently open file/i);
  });

  it("contains the real endpoint URL", () => {
    expect(output).toContain(ENDPOINT);
  });

  it("contains every expected field name", () => {
    for (const field of BASE_FIELDS) {
      expect(output).toContain(field.name);
    }
  });

  it("never emits a secret-looking token", () => {
    assertNoSecrets(output, "v0 prompt");
  });

  it("appends v0-specific caveat", () => {
    expect(output).toContain("one component at a time");
  });
});

// ---------------------------------------------------------------------------
// generateIntegrationPrompt — visual_editor builders
// ---------------------------------------------------------------------------

describe("generateIntegrationPrompt — framer (visual_editor)", () => {
  const ctx = makeCtx({ builder: "framer" });
  const output = generateIntegrationPrompt(ctx);

  it("produces configuration text, not a coding prompt", () => {
    // Must not contain code-specific instructions like 'import' or 'useState'
    expect(output).not.toContain("import {");
    expect(output).not.toContain("useState");
    expect(output).not.toContain("async function handleSubmit");
  });

  it("contains the real endpoint URL", () => {
    expect(output).toContain(ENDPOINT);
  });

  it("contains configuration step instructions", () => {
    expect(output).toMatch(/configure|configuration|action|POST URL/i);
  });

  it("contains every expected field name", () => {
    for (const field of BASE_FIELDS) {
      expect(output).toContain(field.name);
    }
  });

  it("never emits a secret-looking token", () => {
    assertNoSecrets(output, "framer prompt");
  });

  it("appends Framer-specific caveat", () => {
    expect(output).toContain("no coding agent");
  });
});

describe("generateIntegrationPrompt — webflow (visual_editor)", () => {
  const ctx = makeCtx({ builder: "webflow" });
  const output = generateIntegrationPrompt(ctx);

  it("produces configuration text, not a coding prompt", () => {
    expect(output).not.toContain("useState");
    expect(output).not.toContain("async function handleSubmit");
  });

  it("appends Webflow-specific caveat", () => {
    expect(output).toContain("native form handler");
  });

  it("never emits a secret-looking token", () => {
    assertNoSecrets(output, "webflow prompt");
  });
});

// ---------------------------------------------------------------------------
// generateIntegrationPrompt — captcha enabled
// ---------------------------------------------------------------------------

describe("generateIntegrationPrompt — captchaEnabled", () => {
  const ctx = makeCtx({ builder: "cursor", captchaEnabled: true });
  const output = generateIntegrationPrompt(ctx);

  it("mentions Turnstile", () => {
    expect(output).toContain("Turnstile");
  });

  it("mentions cf-turnstile-response field", () => {
    expect(output).toContain("cf-turnstile-response");
  });

  it("never emits a secret-looking token", () => {
    assertNoSecrets(output, "captcha prompt");
  });
});

// ---------------------------------------------------------------------------
// generateIntegrationPrompt — hasFileUpload
// ---------------------------------------------------------------------------

describe("generateIntegrationPrompt — hasFileUpload", () => {
  const ctx = makeCtx({
    builder: "cursor",
    hasFileUpload: true,
    fields: [
      { name: "email", type: "email", required: true },
      { name: "attachment", type: "file", required: false },
    ],
  });
  const output = generateIntegrationPrompt(ctx);

  it("mentions FormData / multipart", () => {
    expect(output).toMatch(/FormData|multipart/i);
  });

  it("never emits a secret-looking token", () => {
    assertNoSecrets(output, "file upload prompt");
  });
});

// ---------------------------------------------------------------------------
// generateRepairPrompt
// ---------------------------------------------------------------------------

describe("generateRepairPrompt", () => {
  const drift: DriftEvidence = {
    deployedFieldName: "userEmail",
    expectedFieldName: "email",
    context: "Observed in network tab on 2026-08-23",
  };
  const ctx = { ...makeCtx({ builder: "cursor" }), drift };
  const output = generateRepairPrompt(ctx);

  it("contains the wrong (deployed) field name", () => {
    expect(output).toContain(drift.deployedFieldName);
  });

  it("contains the correct (expected) field name", () => {
    expect(output).toContain(drift.expectedFieldName);
  });

  it("leads with evidence of the mismatch", () => {
    // The evidence string should appear near the top — within the first 400 chars.
    const evidenceIdx = output.indexOf(drift.deployedFieldName);
    expect(evidenceIdx).toBeGreaterThanOrEqual(0);
    expect(evidenceIdx).toBeLessThan(400);
  });

  it("scopes the change narrowly", () => {
    expect(output).toMatch(/only|ONLY/);
    expect(output).toContain("Contact Us");
  });

  it("contains the endpoint", () => {
    expect(output).toContain(ENDPOINT);
  });

  it("includes the drift context", () => {
    expect(output).toContain(drift.context);
  });

  it("never emits a secret-looking token", () => {
    assertNoSecrets(output, "repair prompt");
  });
});

describe("generateRepairPrompt — file-scoped builder (v0)", () => {
  const drift: DriftEvidence = {
    deployedFieldName: "fullName",
    expectedFieldName: "name",
  };
  const ctx = { ...makeCtx({ builder: "v0" }), drift };
  const output = generateRepairPrompt(ctx);

  it("mentions opening the target component", () => {
    expect(output).toMatch(/open the component|open.*file|currently open file/i);
  });
});

// ---------------------------------------------------------------------------
// generateScannerFixPrompt
// ---------------------------------------------------------------------------

describe("generateScannerFixPrompt", () => {
  const issue: ScannerIssue = {
    code: "missing-aria-label",
    description: "The email input has no associated label or aria-label attribute.",
    location: "#email-input",
    suggestedFix: "Add <label for=\"email\"> or aria-label=\"Email address\" to the input.",
  };
  const ctx = { ...makeCtx({ builder: "cursor" }), issue };
  const output = generateScannerFixPrompt(ctx);

  it("contains the issue code", () => {
    expect(output).toContain(issue.code);
  });

  it("contains the issue description", () => {
    expect(output).toContain(issue.description);
  });

  it("contains the location", () => {
    expect(output).toContain(issue.location);
  });

  it("contains the suggested fix", () => {
    expect(output).toContain(issue.suggestedFix);
  });

  it("scopes the fix to the named form", () => {
    expect(output).toContain("Contact Us");
  });

  it("contains the endpoint", () => {
    expect(output).toContain(ENDPOINT);
  });

  it("never emits a secret-looking token", () => {
    assertNoSecrets(output, "scanner fix prompt");
  });
});

describe("generateScannerFixPrompt — builder with caveats (lovable)", () => {
  const issue: ScannerIssue = {
    code: "no-success-state",
    description: "The form does not show a success message after submission.",
  };
  const ctx = { ...makeCtx({ builder: "lovable" }), issue };
  const output = generateScannerFixPrompt(ctx);

  it("appends Lovable-specific caveat", () => {
    expect(output).toContain("regenerates");
  });
});

// ---------------------------------------------------------------------------
// Null-allowed-origin case
// ---------------------------------------------------------------------------

describe("generateIntegrationPrompt — no allowedOrigin restriction", () => {
  const ctx = makeCtx({ builder: "cursor", allowedOrigin: null });
  const output = generateIntegrationPrompt(ctx);

  it("mentions open / any origin", () => {
    expect(output).toMatch(/any origin|allows all origins/i);
  });
});
