/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Make (formerly Integromat) integration driver — forwards form submissions to a
 * Make scenario via a "Custom Webhook" trigger URL.
 *
 * Required config (stored in integrations.config — non-secret):
 *   - webhookUrl : The Make Custom Webhook URL
 *                  (https://hook.eu1.make.com/… or https://hook.us1.make.com/…)
 *
 * SSRF risk: webhookUrl is user-supplied and MUST be validated via
 * assertSafeEgressUrl before every outbound call. The allowed hostname prefix
 * check below adds defence-in-depth but does NOT replace SSRF validation.
 *
 * Make does not provide built-in idempotency for custom webhooks. Duplicate
 * deliveries on retry will trigger the scenario twice. Document this in the UI.
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

/** Known Make webhook hostname prefixes. Defence-in-depth; SSRF check still runs. */
const MAKE_HOSTNAMES = ["hook.eu1.make.com", "hook.eu2.make.com", "hook.us1.make.com", "hook.us2.make.com"];

interface MakeConfig {
  readonly webhookUrl: string;
}

export class MakeDriver implements IntegrationProvider {
  readonly permissionExplanation =
    "Sends form submission data to a Make (formerly Integromat) Webhook URL " +
    `you provide. ${brand.name} will POST every new submission as JSON to that ` +
    "URL, triggering any Make scenario you connect to it.";

  readonly #webhookUrl: string;

  constructor(config: MakeConfig) {
    if (!config.webhookUrl) {
      throw new IntegrationConfigError(
        "Make driver requires webhookUrl in config",
        "make",
        "webhookUrl",
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(config.webhookUrl);
    } catch {
      throw new IntegrationConfigError("Make webhookUrl is not a valid URL", "make", "webhookUrl");
    }
    if (!MAKE_HOSTNAMES.some((h) => parsed.hostname === h)) {
      throw new IntegrationConfigError(
        `Make webhookUrl hostname must be one of: ${MAKE_HOSTNAMES.join(", ")}`,
        "make",
        "webhookUrl",
      );
    }
    this.#webhookUrl = config.webhookUrl;
  }

  async connect(_config: IntegrationPayload): Promise<void> {
    const result = await this.test();
    if (!result.ok) {
      throw new IntegrationConfigError(`Make connect failed: ${result.message}`, "make");
    }
  }

  async disconnect(): Promise<void> {
    // Make webhooks are disabled via the Make scenario editor — no API revocation.
  }

  async test(): Promise<TestResult> {
    try {
      const safeUrl = await assertSafeEgressUrl(this.#webhookUrl);
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _submitpulse_test: true }),
      });
      if (res.ok) return { ok: true, message: "Make webhook reachable" };
      return { ok: false, message: `Make returned HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: "Make test error", detail: String(err) };
    }
  }

  async send(event: IntegrationEvent, payload: IntegrationPayload): Promise<DeliveryResult> {
    try {
      const safeUrl = await assertSafeEgressUrl(this.#webhookUrl);
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _event: event, ...payload }),
      });
      if (res.ok) return { ok: true };
      const retryable = res.status === 429 || res.status >= 500;
      return { ok: false, retryable, message: `Make HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, retryable: true, message: "Make send error", detail: String(err) };
    }
  }
}
