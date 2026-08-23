/**
 * SHA-256 helpers for API keys, tokens, fingerprints, and content hashes.
 *
 * All operations are constant-time where it matters (key comparison via
 * timingSafeEqual). Raw bytes are never exposed — callers get hex strings.
 */

/** Compute the hex-encoded SHA-256 digest of an arbitrary string. */
export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return bufToHex(buf);
}

/** Compute the hex-encoded SHA-256 digest of raw bytes. */
export async function sha256HexBytes(input: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", input);
  return bufToHex(buf);
}

/**
 * Hash an API key for safe storage. The key MUST be the full secret value,
 * not a truncated display snippet.
 */
export async function hashApiKey(rawKey: string): Promise<string> {
  return sha256Hex(`apikey:${rawKey}`);
}

/**
 * Hash a short-lived token (setup token, captcha token nonce, etc.).
 */
export async function hashToken(rawToken: string): Promise<string> {
  return sha256Hex(`token:${rawToken}`);
}

/**
 * Build a submission fingerprint from the request provenance signals.
 * Used for repeat-payload / flooding detection — NOT for identity.
 */
export async function submissionFingerprint(opts: {
  readonly ip: string;
  readonly userAgent: string;
  readonly formId: string;
  readonly bodyHash: string;
}): Promise<string> {
  const raw = `fingerprint:${opts.ip}|${opts.userAgent}|${opts.formId}|${opts.bodyHash}`;
  return sha256Hex(raw);
}

/**
 * Constant-time comparison of two hex digests.
 * Use this whenever comparing stored hash vs computed hash to avoid
 * timing side-channels.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < ab.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    diff |= ab[i]! ^ bb[i]!;
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
