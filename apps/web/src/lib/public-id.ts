/**
 * Public form ID generator.
 *
 * Generates an unguessable-but-not-secret public form identifier.
 * The ID is public by design — the form endpoint is public, and no ID secrecy
 * is assumed. Abuse protection comes from domain rules and bot protection, not
 * from keeping this ID hidden. 128 bits of entropy from crypto.getRandomValues
 * makes collision and brute-force impractical.
 *
 * The resulting ID satisfies the DB check constraint: ^fm_[A-Za-z0-9]{22,}$
 * (or whatever the brand prefix is — read from brand module, not hardcoded).
 */

import { brand } from "@submitpulse/config";

const BASE62_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function toBase62(bytes: Uint8Array): string {
  let result = "";
  // Process bytes as a big-endian integer via repeated base-62 extraction.
  // We use a simple approach: treat each byte as contributing entropy by
  // repeatedly sampling via rejection sampling to avoid modulo bias.
  const values = Array.from(bytes);
  let i = 0;
  while (result.length < 22 && i < values.length) {
    const byte = values[i];
    if (byte === undefined) break;
    // Rejection sampling: only accept values < 248 (248 = floor(256/62)*62).
    if (byte < 248) {
      result += BASE62_CHARS[byte % 62];
    }
    i++;
  }
  return result;
}

/**
 * Generate a public form ID.
 *
 * Uses crypto.getRandomValues for 128 bits (16 bytes) of entropy, then
 * encodes to base62. Extra bytes (32 total) ensure we always get >=22 chars
 * even after rejection sampling.
 *
 * The prefix comes from the brand module so a product rename requires no
 * changes to this file.
 */
export function generatePublicFormId(): string {
  // 32 bytes gives ~44 base62 chars before rejection sampling.
  // After rejection sampling we still comfortably exceed 22 chars.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const encoded = toBase62(bytes);

  // Pad with additional randomness if rejection sampling produced < 22 chars
  // (extremely unlikely with 32 bytes, but safe).
  if (encoded.length < 22) {
    const extra = new Uint8Array(16);
    crypto.getRandomValues(extra);
    const more = toBase62(extra);
    return `${brand.identifiers.form}_${(encoded + more).slice(0, 22)}`;
  }

  return `${brand.identifiers.form}_${encoded.slice(0, 22)}`;
}
