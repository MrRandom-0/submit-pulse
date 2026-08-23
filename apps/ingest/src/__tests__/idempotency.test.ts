/**
 * Idempotency tests.
 *
 * Verifies that submitting twice with the same Idempotency-Key returns the
 * original submission rather than creating a duplicate.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DevFormRepository } from "../repository/dev-form-repository.js";
import { persistSubmission } from "../pipeline/persistence.js";
import type { FormRow } from "../types.js";
import type { SpamEvaluation } from "../pipeline/spam-rules.js";

// ---------------------------------------------------------------------------
// Minimal KV mock
// ---------------------------------------------------------------------------

class InMemoryKV {
  private store = new Map<string, { value: string; expiry?: number }>();

  async get(key: string, type: "json"): Promise<unknown | null>;
  async get(key: string, type?: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (entry === undefined) return null;
    if (type === "json") return JSON.parse(entry.value) as unknown as string;
    return entry.value;
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, { value, expiry: opts?.expirationTtl });
  }

  clear(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const FORM: FormRow = {
  id: "form-uuid-1234",
  publicId: "fm_abc123",
  workspaceId: "ws-uuid-1234",
  status: "active",
  captchaEnabled: false,
  honeypotFieldName: null,
  enforceOrigin: false,
  allowLocalhost: true,
  maxBodyBytes: 1_048_576,
  fileUploadsEnabled: false,
  activeSchemaVersionId: null,
  domains: [],
  fields: [],
};

const SPAM: SpamEvaluation = {
  verdict: "clean",
  score: 0,
  signals: [],
};

function makeInput(idempotencyKey: string | null) {
  return {
    formId: FORM.id,
    workspaceId: FORM.workspaceId,
    requestId: crypto.randomUUID(),
    idempotencyKey,
    data: { name: "Alice", email: "alice@example.com" },
    unexpectedData: {},
    schemaVersionId: null,
    spam: SPAM,
    clientIp: "1.2.3.4",
    userAgent: "TestAgent/1.0",
    referrer: null,
    originHeader: "https://example.com",
    countryCode: "US",
    isSynthetic: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("idempotency — same key returns same submission", () => {
  let repo: DevFormRepository;
  let kv: InMemoryKV;

  beforeEach(() => {
    repo = new DevFormRepository();
    repo.seedForm(FORM);
    kv = new InMemoryKV();
  });

  it("first call creates a new submission", async () => {
    const result = await persistSubmission(
      makeInput("key-abc"),
      repo,
      kv as unknown as KVNamespace,
      "req-1",
      null,
    );
    expect(result instanceof Response).toBe(false);
    if (result instanceof Response) throw new Error("unexpected Response");
    expect(result.isIdempotentRepeat).toBe(false);
    expect(result.publicId).toMatch(/^sub_/);
  });

  it("second call with same key returns first submission", async () => {
    const first = await persistSubmission(
      makeInput("key-abc"),
      repo,
      kv as unknown as KVNamespace,
      "req-1",
      null,
    );
    if (first instanceof Response) throw new Error("unexpected Response");

    const second = await persistSubmission(
      makeInput("key-abc"),
      repo,
      kv as unknown as KVNamespace,
      "req-2",
      null,
    );
    if (second instanceof Response) throw new Error("unexpected Response");

    expect(second.isIdempotentRepeat).toBe(true);
    expect(second.publicId).toBe(first.publicId);
    expect(second.submissionId).toBe(first.submissionId);
  });

  it("different keys create independent submissions", async () => {
    const a = await persistSubmission(
      makeInput("key-aaa"),
      repo,
      kv as unknown as KVNamespace,
      "req-1",
      null,
    );
    const b = await persistSubmission(
      makeInput("key-bbb"),
      repo,
      kv as unknown as KVNamespace,
      "req-2",
      null,
    );
    if (a instanceof Response || b instanceof Response) throw new Error("unexpected Response");
    expect(a.publicId).not.toBe(b.publicId);
  });

  it("null key always creates new submissions", async () => {
    const a = await persistSubmission(
      makeInput(null),
      repo,
      kv as unknown as KVNamespace,
      "req-1",
      null,
    );
    const b = await persistSubmission(
      makeInput(null),
      repo,
      kv as unknown as KVNamespace,
      "req-2",
      null,
    );
    if (a instanceof Response || b instanceof Response) throw new Error("unexpected Response");
    expect(a.publicId).not.toBe(b.publicId);
    expect(a.isIdempotentRepeat).toBe(false);
    expect(b.isIdempotentRepeat).toBe(false);
  });
});
