/**
 * Stage 9 — Persistence.
 *
 * Write the submission row to the database.
 *
 * Idempotency: before inserting, check the IDEMPOTENCY_KV namespace for a
 * previously stored (formId, idempotencyKey) → submissionPublicId mapping.
 * KV is used instead of the DB to keep this check at edge latency.
 *
 * Public ID format: sub_<uuid-hex> — "sub" from brand.identifiers.submission.
 *
 * NOTE: email delivery, webhook calls, and AI spam analysis are NOT performed
 * here. They are queued in stage 10 and handled by the async worker.
 */

import { brand } from "@submitpulse/config/brand";
import { sha256Hex, submissionFingerprint } from "@submitpulse/security/hash";
import type { FormRepository, NewSubmission, ExistingSubmission } from "../types.js";
import type { SpamEvaluation } from "./spam-rules.js";
import { Errors } from "../response.js";

export interface PersistenceInput {
  readonly formId: string;
  readonly workspaceId: string;
  readonly requestId: string;
  readonly idempotencyKey: string | null;
  readonly data: Record<string, unknown>;
  readonly unexpectedData: Record<string, unknown>;
  readonly schemaVersionId: string | null;
  readonly spam: SpamEvaluation;
  readonly clientIp: string;
  readonly userAgent: string | null;
  readonly referrer: string | null;
  readonly originHeader: string | null;
  readonly countryCode: string | null;
  readonly isSynthetic: boolean;
}

export interface PersistenceResult {
  readonly submissionId: string;
  readonly publicId: string;
  readonly isIdempotentRepeat: boolean;
}

/**
 * Idempotency KV key — scoped to formId to avoid cross-form collisions.
 */
function idempotencyKvKey(formId: string, key: string): string {
  return `idempotency:${formId}:${key}`;
}

/**
 * Generate a public submission ID.
 * Format: sub_<32-char-hex> (128 bits of entropy).
 */
function generateSubmissionPublicId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${brand.identifiers.submission}_${hex}`;
}

export async function persistSubmission(
  input: PersistenceInput,
  repository: FormRepository,
  idempotencyKv: KVNamespace,
  requestId: string,
  corsOrigin: string | null,
): Promise<PersistenceResult | Response> {
  // --- Idempotency check ---
  if (input.idempotencyKey !== null) {
    const kvKey = idempotencyKvKey(input.formId, input.idempotencyKey);

    let existing: ExistingSubmission | null = null;

    // First check KV cache (fast path).
    const cached = await idempotencyKv.get(kvKey, "json") as ExistingSubmission | null;
    if (cached !== null) {
      return {
        submissionId: cached.id,
        publicId: cached.publicId,
        isIdempotentRepeat: true,
      };
    }

    // Slow path: check the database.
    try {
      existing = await repository.findByIdempotencyKey(
        input.formId,
        input.idempotencyKey,
      );
    } catch {
      return Errors.serviceUnavailable(requestId, corsOrigin);
    }

    if (existing !== null) {
      // Populate KV cache for future requests.
      await idempotencyKv.put(kvKey, JSON.stringify(existing), {
        expirationTtl: 86400, // 24 hours
      });
      return {
        submissionId: existing.id,
        publicId: existing.publicId,
        isIdempotentRepeat: true,
      };
    }
  }

  // --- Build provenance signals ---
  const bodyHash = await sha256Hex(JSON.stringify(input.data));
  const fingerprint = await submissionFingerprint({
    ip: input.clientIp,
    userAgent: input.userAgent ?? "",
    formId: input.formId,
    bodyHash,
  });

  const publicId = generateSubmissionPublicId();

  const row: NewSubmission = {
    formId: input.formId,
    workspaceId: input.workspaceId,
    publicId,
    requestId,
    idempotencyKey: input.idempotencyKey,
    origin: input.isSynthetic ? "synthetic" : "live",
    data: input.data,
    unexpectedData: Object.keys(input.unexpectedData).length > 0
      ? input.unexpectedData
      : null,
    schemaVersionId: input.schemaVersionId,
    spamVerdict: input.spam.verdict,
    spamScore: input.spam.score,
    ipAddress: input.clientIp !== "" ? input.clientIp : null,
    fingerprint,
    userAgent: input.userAgent,
    referrer: input.referrer,
    originHeader: input.originHeader,
    countryCode: input.countryCode,
  };

  let submissionId: string;
  try {
    submissionId = await repository.createSubmission(row);
  } catch {
    // Never leak DB errors.
    return Errors.serviceUnavailable(requestId, corsOrigin);
  }

  // Cache the idempotency mapping in KV.
  if (input.idempotencyKey !== null) {
    const kvKey = idempotencyKvKey(input.formId, input.idempotencyKey);
    const cached: ExistingSubmission = { id: submissionId, publicId, requestId };
    await idempotencyKv.put(kvKey, JSON.stringify(cached), {
      expirationTtl: 86400,
    });
  }

  return { submissionId, publicId, isIdempotentRepeat: false };
}
