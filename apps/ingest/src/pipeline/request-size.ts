/**
 * Stage 1 — Request size guard.
 *
 * Enforce an absolute upper bound BEFORE reading the body, so we never buffer
 * an attacker-controlled multi-GB stream. The per-form limit is enforced again
 * in the form-lookup stage once the form row is available.
 *
 * The absolute ceiling here is 26 MB — the database CHECK constraint maximum
 * for form.max_body_bytes (26214400). Individual forms set a lower limit.
 */

import { Errors } from "../response.js";

/** Absolute ceiling, matching the database constraint upper bound. */
const ABSOLUTE_MAX_BYTES = 26_214_400;

/**
 * Read and return the request body, rejecting if it exceeds `maxBytes`.
 *
 * Returns null when Content-Length is missing (body streamed — caller must
 * handle). When Content-Length is present and too large we reject immediately
 * without reading.
 */
export async function readBodyWithSizeGuard(
  request: Request,
  maxBytes: number,
  requestId: string,
): Promise<{ body: ArrayBuffer } | Response> {
  const limit = Math.min(maxBytes, ABSOLUTE_MAX_BYTES);

  // Fast-path: reject on Content-Length alone before buffering.
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declared = parseInt(contentLength, 10);
    if (!isNaN(declared) && declared > limit) {
      return Errors.payloadTooLarge(requestId, null);
    }
  }

  // Buffer the body up to limit + 1 byte so we can detect exceeding without
  // reading beyond.
  const body = await request.arrayBuffer().catch(() => null);
  if (body === null) {
    return Errors.serviceUnavailable(requestId, null);
  }

  if (body.byteLength > limit) {
    return Errors.payloadTooLarge(requestId, null);
  }

  return { body };
}
