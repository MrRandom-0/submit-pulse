/**
 * Email idempotency key derivation.
 *
 * KEY SCHEME:
 *   SHA-256( submissionId + ":" + destinationId + ":" + kind + ":" + attempt )
 *
 * - submissionId   — the submission that triggered the email.
 * - destinationId  — UUID of the email_destinations or autoresponders row.
 *                    For non-submission emails (billing, incident) pass the
 *                    relevant entity ID.
 * - kind           — one of the email_deliveries.kind enum values:
 *                    notification | autoresponder | verification |
 *                    invitation | billing | incident
 * - attempt        — zero-based attempt index. Always "0" on the first send.
 *                    Only increment for true logical retries (worker crashed,
 *                    network error). Do NOT increment for retry-storm
 *                    scenarios — use the same key so the DB unique constraint
 *                    prevents the duplicate.
 *
 * The key is stored in email_deliveries.idempotency_key and there is a UNIQUE
 * constraint on that column. The worker does INSERT … ON CONFLICT DO NOTHING
 * before calling the provider, so a crashed-and-retried job cannot send twice.
 *
 * NOTE: `attempt` is included so that a legitimate re-send after an explicit
 * human "resend" action can generate a new key while still being idempotent
 * within that attempt.
 */

import { createHash } from "node:crypto";

export interface IdempotencyKeyParams {
  submissionId: string;
  destinationId: string;
  kind: string;
  /** Zero-based attempt index. Default 0. */
  attempt?: number;
}

/**
 * Derive a stable, opaque idempotency key for an email send attempt.
 * Returns a lowercase hex SHA-256 string suitable for storage in the DB.
 */
export function deriveEmailIdempotencyKey(params: IdempotencyKeyParams): string {
  const attempt = params.attempt ?? 0;
  const raw = `${params.submissionId}:${params.destinationId}:${params.kind}:${attempt}`;
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Check whether a delivery idempotency key already exists in the tracked set.
 * This is a pure helper for in-memory checks; the authoritative check is the
 * DB unique constraint enforced at INSERT time.
 */
export function isAlreadySent(
  key: string,
  sentKeys: ReadonlySet<string>,
): boolean {
  return sentKeys.has(key);
}
