/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Zapier integration driver — forwards form submissions to a Zapier "Catch Hook"
 * trigger via a user-supplied Zapier Webhook URL.
 *
 * Required config (stored in integrations.config — non-secret):
 *   - webhookUrl : The Zapier Catch Hook URL (https://hooks.zapier.com/hooks/catch/…)
 *
 * No credentials are stored; the Zapier webhook URL is the secret by itself.
 * As such it is stored in integrations.config (not credentials) in this
 * implementation — revisit if the security model requires encrypting it.
 *
 * SSRF risk: webhookUrl is user-supplied and MUST be validated via
 * assertSafeEgressUrl before every outbound call. Do not skip this step.
 *
 * Zapier does not provide idempotency keys. Duplicate deliveries on retry will
 * trigger the Zap twice. Document this limitation in the UI.
 */

import { assertSafeEgressUrl, safeFetch } from "@submitpulse/security/ssrf";
import type {
  DeliveryResult,
  IntegrationEvent,
  IntegrationPayload,
  IntegrationProvider,
  TestResult,
} from "../provider";
import { IntegrationConfigError } from "../provider";
import { brand } from "@submitpulse/config";

interface ZapierConfig {
  readonly webhookUrl: string;
}

export class ZapierDriver implements IntegrationProvider {
  readonly permissionExplanation =
    "Sends form submission data to a Zapier Webhook URL you provide. " +
    `${brand.name} will POST every new submission as JSON to that URL, ` +
    "triggering any Zap you connect to it. Only you control which Zap " +
    "receives the data.";

  readonly #webhookUrl: string;

  constructor(config: ZapierConfig) {
    if (!config.webhookUrl) {
      throw new IntegrationConfigError(
        "Zapier driver requires webhookUrl in config",
        "zapier",
        "webhookUrl",
      );
    }
    if (!config.webhookUrl.startsWith("https://hooks.zapier.com/")) {
      throw new IntegrationConfigError(
        "Zapier webhookUrl must start with https://hooks.zapier.com/",
        "zapier",
        "webhookUrl",
      );
    }
    this.#webhookUrl = config.webhookUrl;
  }

  async connect(_config: IntegrationPayload): Promise<void> {
    const result = await this.test();
    if (!result.ok) {
      throw new IntegrationConfigError(`Zapier connect failed: ${result.message}`, "zapier");
    }
  }

  async disconnect(): Promise<void> {
    // Zapier webhooks are disabled via the Zapier UI — no API revocation.
  }

  async test(): Promise<TestResult> {
    try {
      // SSRF check on user-supplied URL is mandatory here.
      const safeUrl = await assertSafeEgressUrl(this.#webhookUrl);
      // Zapier returns 200 even for malformed payloads, so a GET is cleaner.
      // However Zapier only accepts POST; send a minimal test payload instead.
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _submitpulse_test: true }),
      });
      if (res.ok) return { ok: true, message: "Zapier webhook reachable" };
      return { ok: false, message: `Zapier returned HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: "Zapier test error", detail: String(err) };
    }
  }

  async send(event: IntegrationEvent, payload: IntegrationPayload): Promise<DeliveryResult> {
    try {
      // Re-validate on every send; the stored URL could have been tampered with.
      const safeUrl = await assertSafeEgressUrl(this.#webhookUrl);
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _event: event, ...payload }),
      });
      if (res.ok) return { ok: true };
      const retryable = res.status === 429 || res.status >= 500;
      return { ok: false, retryable, message: `Zapier HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, retryable: true, message: "Zapier send error", detail: String(err) };
    }
  }
}
