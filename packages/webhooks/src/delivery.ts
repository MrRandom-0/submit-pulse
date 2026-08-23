/**
 * Webhook delivery — send one HTTP POST to a customer endpoint.
 *
 * SSRF: Every target URL is validated via assertSafeEgressUrl (from
 * @submitpulse/security) BEFORE opening a connection. This blocks private IP
 * ranges, cloud metadata endpoints, loopback, and non-standard ports.
 *
 * RESPONSE BODY CAP: The response body is read up to RESPONSE_BODY_SNIPPET_BYTES
 * bytes only. Storing unlimited response bodies would allow a malicious endpoint
 * to cause unbounded storage growth (DoS against the platform's storage budget).
 *
 * TIMEOUT: Connections that do not respond within TIMEOUT_MS are aborted.
 */

import { brand } from "@submitpulse/config";
import { assertSafeEgressUrl, safeFetch } from "@submitpulse/security";
import { signWebhook } from "./signing.js";
import type { AnyWebhookPayload } from "./events.js";

/** Maximum bytes to capture from the response body. */
export const RESPONSE_BODY_SNIPPET_BYTES = 512;

/** Total timeout for one delivery attempt in milliseconds. */
export const TIMEOUT_MS = 30_000;

export interface DeliveryInput {
  /** Target URL — will be SSRF-validated. */
  url: string;
  /** Plaintext HMAC signing secret. */
  secret: string;
  /** Opaque delivery UUID (appears in DB + response header). */
  deliveryId: string;
  /** The event payload to send. */
  payload: AnyWebhookPayload;
}

export interface DeliveryAttemptResult {
  success: boolean;
  httpStatus: number | null;
  durationMs: number;
  /** First RESPONSE_BODY_SNIPPET_BYTES bytes of the response body. */
  responseBodySnippet: string | null;
  /** Error message if success is false. */
  error: string | null;
  /** Headers that were sent (for audit logging; MUST NOT include the raw secret). */
  requestHeaders: Record<string, string>;
}

/**
 * Attempt to deliver one webhook event to the customer's endpoint.
 * Records the attempt duration and response snippet for audit logging.
 * Does NOT write to the database — the caller is responsible for persistence.
 */
export async function attemptDelivery(input: DeliveryInput): Promise<DeliveryAttemptResult> {
  const body = JSON.stringify(input.payload);
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Sign the payload.
  const sigHeaders = signWebhook(input.secret, body, input.deliveryId, nowSeconds);

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": brand.wire.userAgent,
    ...sigHeaders,
  };

  const startMs = Date.now();
  let httpStatus: number | null = null;
  let responseBodySnippet: string | null = null;
  let error: string | null = null;
  let success = false;

  try {
    // SSRF validation — throws SsrfError for private/blocked URLs.
    const safeUrl = await assertSafeEgressUrl(input.url);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await safeFetch(safeUrl, {
        method: "POST",
        headers: requestHeaders,
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    httpStatus = response.status;

    // Capture a limited response body snippet.
    const reader = response.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let done = false;

      while (!done && totalBytes < RESPONSE_BODY_SNIPPET_BYTES) {
        const result = await reader.read();
        if (result.done) {
          done = true;
        } else {
          const remaining = RESPONSE_BODY_SNIPPET_BYTES - totalBytes;
          const chunk = result.value.slice(0, remaining);
          chunks.push(chunk);
          totalBytes += chunk.length;
        }
      }
      // Cancel any remaining body to avoid resource leaks.
      await reader.cancel().catch(() => undefined);

      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      responseBodySnippet = new TextDecoder("utf-8", { fatal: false }).decode(combined);
    }

    // 2xx means success; anything else is a delivery failure.
    success = response.status >= 200 && response.status < 300;
    if (!success) {
      error = `Endpoint returned HTTP ${response.status}`;
    }
  } catch (err: unknown) {
    error =
      err instanceof Error
        ? `${err.name}: ${err.message}`.slice(0, 512)
        : "Unknown error during delivery";
  }

  const durationMs = Date.now() - startMs;
  return { success, httpStatus, durationMs, responseBodySnippet, error, requestHeaders };
}
