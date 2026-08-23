/**
 * Webhook payload signing and verification.
 *
 * SIGNATURE SCHEME
 * ────────────────
 * The signature covers: timestamp + "." + raw body bytes.
 * Algorithm: HMAC-SHA256, hex-encoded.
 *
 * Outbound headers (names from brand.wire.*):
 *   x-submitpulse-signature   — "sha256=<hex>"
 *   x-submitpulse-timestamp   — Unix seconds (string)
 *   x-submitpulse-delivery-id — opaque UUID for this delivery attempt
 *
 * REPLAY WINDOW
 * ─────────────
 * Receivers MUST reject requests where |now - timestamp| > REPLAY_WINDOW_SECONDS
 * (default: 300 seconds / 5 minutes). This limits the window during which a
 * captured request can be replayed. The verify() helper enforces this
 * automatically. Customers who call verify() do not need to implement their own
 * replay check.
 *
 * CONSTANT-TIME COMPARISON
 * ─────────────────────────
 * verify() uses a timing-safe byte-by-byte comparison (timingSafeEqual from
 * node:crypto). A naive string === check leaks information about the number of
 * matching prefix bytes, which enables timing attacks against HMAC verification.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { brand } from "@submitpulse/config";

/** Replay protection window in seconds. */
export const REPLAY_WINDOW_SECONDS = 300;

export interface WebhookSignatureHeaders {
  [key: string]: string;
}

/**
 * Sign a webhook payload.
 * Returns the three headers that must be attached to the outbound request.
 *
 * @param secret     Plaintext HMAC signing secret (customer-held).
 * @param body       Raw request body bytes (the exact bytes sent over the wire).
 * @param deliveryId Opaque UUID identifying this delivery attempt.
 * @param nowSeconds Unix timestamp in seconds (default: Date.now() / 1000).
 */
export function signWebhook(
  secret: string,
  body: string,
  deliveryId: string,
  nowSeconds?: number,
): WebhookSignatureHeaders {
  const ts = nowSeconds ?? Math.floor(Date.now() / 1000);
  const signingPayload = `${ts}.${body}`;
  const signature = createHmac("sha256", secret)
    .update(signingPayload, "utf8")
    .digest("hex");

  return {
    [brand.wire.signatureHeader]: `sha256=${signature}`,
    [brand.wire.timestampHeader]: String(ts),
    [brand.wire.deliveryIdHeader]: deliveryId,
  };
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verify an inbound webhook request.
 *
 * CONSTANT-TIME: comparison is performed with timingSafeEqual to prevent
 * timing-based side-channel attacks.
 *
 * REPLAY PROTECTION: timestamps outside the REPLAY_WINDOW_SECONDS window are
 * rejected to prevent a captured request from being replayed later.
 *
 * @param secret        Plaintext HMAC signing secret.
 * @param body          Raw request body exactly as received (before any parsing).
 * @param headers       Object containing the request headers (lowercase names).
 * @param nowSeconds    Current time in Unix seconds (default: Date.now() / 1000).
 */
export function verifyWebhook(
  secret: string,
  body: string,
  headers: Readonly<Record<string, string | undefined>>,
  nowSeconds?: number,
): VerifyResult {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);

  const rawTimestamp = headers[brand.wire.timestampHeader];
  const rawSignature = headers[brand.wire.signatureHeader];

  if (!rawTimestamp) {
    return { valid: false, reason: `Missing header: ${brand.wire.timestampHeader}` };
  }
  if (!rawSignature) {
    return { valid: false, reason: `Missing header: ${brand.wire.signatureHeader}` };
  }

  const ts = parseInt(rawTimestamp, 10);
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: "Timestamp header is not a valid integer" };
  }

  // Replay window check.
  if (Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
    return {
      valid: false,
      reason: `Timestamp ${ts} is outside the ${REPLAY_WINDOW_SECONDS}s replay window`,
    };
  }

  // Verify signature prefix "sha256=".
  if (!rawSignature.startsWith("sha256=")) {
    return { valid: false, reason: "Signature does not start with 'sha256='" };
  }
  const receivedHex = rawSignature.slice("sha256=".length);

  const signingPayload = `${ts}.${body}`;
  const expectedHex = createHmac("sha256", secret)
    .update(signingPayload, "utf8")
    .digest("hex");

  // CONSTANT-TIME comparison — prevents timing attacks.
  const receivedBuf = Buffer.from(receivedHex, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  if (receivedBuf.length !== expectedBuf.length) {
    return { valid: false, reason: "Signature length mismatch" };
  }

  const match = timingSafeEqual(receivedBuf, expectedBuf);
  return match ? { valid: true } : { valid: false, reason: "Signature mismatch" };
}
