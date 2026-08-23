/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Generic Webhook integration driver — forwards form submissions as a JSON POST
 * to any HTTPS URL the user supplies.
 *
 * Required config (stored in integrations.config — non-secret):
 *   - url             : Target HTTPS URL (must pass SSRF validation)
 *
 * Optional config:
 *   - signingSecret   : If provided, the request body is HMAC-SHA256-signed and
 *                       the signature is sent in the X-SubmitPulse-Signature
 *                       header (matching brand.wire.signatureHeader). Stored
 *                       encrypted in integrations.credentials.
 *   - customHeaders   : Additional headers to send (e.g. Authorization token).
 *                       Stored encrypted in integrations.credentials.
 *   - timeoutMs       : Per-request timeout (default 10 000 ms, max 30 000 ms).
 *
 * SSRF risk: url is user-supplied. assertSafeEgressUrl is called on EVERY
 * outbound call — never skip or cache the result, as a cached result would not
 * catch DNS rebinding attacks (see packages/security/ssrf.ts header comment).
 *
 * Signing: the HMAC is computed over the raw JSON body using SHA-256 and the
 * signingSecret. The signature is hex-encoded and sent as
 * X-SubmitPulse-Signature: sha256=<hex>. Recipients should verify this header
 * before processing the payload.
 *
 * Idempotency: the X-SubmitPulse-Delivery-ID header carries the stable
 * delivery ID so the receiving server can deduplicate retries.
 */

import { brand } from "@submitpulse/config/brand";
import { assertSafeEgressUrl, safeFetch } from "@submitpulse/security/ssrf";
import type {
  DeliveryResult,
  IntegrationEvent,
  IntegrationPayload,
  IntegrationProvider,
  TestResult,
} from "../provider";
import { IntegrationConfigError } from "../provider";

interface GenericWebhookCredentials {
  readonly signingSecret?: string;
  readonly customHeaders?: Record<string, string>;
}

interface GenericWebhookConfig {
  readonly url: string;
  readonly timeoutMs?: number;
}

const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 10_000;

export class GenericWebhookDriver implements IntegrationProvider {
  readonly permissionExplanation =
    "Sends form submission data as a JSON POST to a URL you specify. " +
    `${brand.name} will include an HMAC signature so your server can verify ` +
    `the request came from ${brand.name} and not a third party. ` +
    "You are responsible for ensuring the target URL is secure and authorised " +
    "to receive submission data.";

  readonly #url: string;
  readonly #signingSecret: string | undefined;
  readonly #customHeaders: Record<string, string>;
  readonly #timeoutMs: number;

  constructor(config: GenericWebhookConfig, credentials: GenericWebhookCredentials = {}) {
    if (!config.url) {
      throw new IntegrationConfigError(
        "Generic webhook driver requires url in config",
        "generic_webhook",
        "url",
      );
    }
    // Validate URL structure at construction time (not a substitute for
    // assertSafeEgressUrl at send time, which also catches DNS rebinding).
    try {
      const parsed = new URL(config.url);
      if (parsed.protocol !== "https:") {
        throw new IntegrationConfigError(
          "Generic webhook URL must use HTTPS",
          "generic_webhook",
          "url",
        );
      }
    } catch (err) {
      if (err instanceof IntegrationConfigError) throw err;
      throw new IntegrationConfigError(
        "Generic webhook URL is invalid",
        "generic_webhook",
        "url",
      );
    }

    this.#url = config.url;
    this.#signingSecret = credentials.signingSecret;
    this.#customHeaders = credentials.customHeaders ?? {};
    this.#timeoutMs = Math.min(
      config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    );
  }

  async connect(_config: IntegrationPayload): Promise<void> {
    const result = await this.test();
    if (!result.ok) {
      throw new IntegrationConfigError(
        `Generic webhook connect failed: ${result.message}`,
        "generic_webhook",
      );
    }
  }

  async disconnect(): Promise<void> {
    // Nothing to revoke — user controls the endpoint.
  }

  async test(): Promise<TestResult> {
    try {
      const safeUrl = await assertSafeEgressUrl(this.#url);
      const body = JSON.stringify({ _submitpulse_test: true });
      const headers = await this.#buildHeaders(body, "test-delivery-id");
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers,
        body,
      });
      if (res.ok || res.status === 204) {
        return { ok: true, message: `Webhook reachable (HTTP ${res.status})` };
      }
      return { ok: false, message: `Webhook returned HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: "Webhook test error", detail: String(err) };
    }
  }

  async send(event: IntegrationEvent, payload: IntegrationPayload): Promise<DeliveryResult> {
    const deliveryId = crypto.randomUUID();
    const envelope = {
      _event: event,
      _deliveryId: deliveryId,
      _timestamp: new Date().toISOString(),
      ...payload,
    };
    const body = JSON.stringify(envelope);

    try {
      // SSRF check on user-supplied URL — called on every send (not cached).
      const safeUrl = await assertSafeEgressUrl(this.#url);
      const headers = await this.#buildHeaders(body, deliveryId);

      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(this.#timeoutMs),
      });

      if (res.ok || res.status === 204) {
        return { ok: true, providerRef: deliveryId };
      }

      const retryable = res.status === 429 || res.status >= 500;
      return { ok: false, retryable, message: `Webhook HTTP ${res.status}`, detail: deliveryId };
    } catch (err) {
      // AbortError = timeout — retryable; network errors also retryable.
      return { ok: false, retryable: true, message: "Webhook send error", detail: String(err) };
    }
  }

  async #buildHeaders(body: string, deliveryId: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": brand.wire.userAgent,
      [brand.wire.deliveryIdHeader]: deliveryId,
      [brand.wire.timestampHeader]: String(Date.now()),
      ...this.#customHeaders,
    };

    if (this.#signingSecret) {
      const sig = await this.#hmacSha256(this.#signingSecret, body);
      headers[brand.wire.signatureHeader] = `sha256=${sig}`;
    }

    return headers;
  }

  async #hmacSha256(secret: string, message: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(message));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
