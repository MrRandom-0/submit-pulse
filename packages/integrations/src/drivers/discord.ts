/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Discord integration driver — sends form submissions as Discord messages via
 * the Discord Webhook API (Incoming Webhooks).
 *
 * Required credentials (stored encrypted in integrations.credentials):
 *   - webhookUrl : Full Discord webhook URL
 *                  (https://discord.com/api/webhooks/{id}/{token})
 *
 * No OAuth scopes are required for webhook-only delivery; the webhook token is
 * the credential. For bot-based posting, a Bot Token with Send Messages
 * permission is needed — that path is not implemented here (extend as needed).
 *
 * Discord webhook URLs must be kept secret; the token embedded in the URL
 * grants the holder the ability to post to the channel indefinitely.
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

interface DiscordCredentials {
  readonly webhookUrl: string;
}

interface DiscordEmbed {
  readonly title: string;
  readonly color: number;
  readonly fields: ReadonlyArray<{ readonly name: string; readonly value: string; readonly inline: boolean }>;
  readonly timestamp: string;
}

export class DiscordDriver implements IntegrationProvider {
  readonly permissionExplanation =
    `Grants ${brand.name} permission to post messages to one Discord channel ` +
    "using a Webhook URL you generate. The integration cannot read messages, " +
    "manage the server, or access other channels.";

  readonly #webhookUrl: string;

  constructor(credentials: DiscordCredentials) {
    if (!credentials.webhookUrl) {
      throw new IntegrationConfigError(
        "Discord driver requires webhookUrl",
        "discord",
        "webhookUrl",
      );
    }
    if (!credentials.webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      throw new IntegrationConfigError(
        "Discord webhookUrl must start with https://discord.com/api/webhooks/",
        "discord",
        "webhookUrl",
      );
    }
    this.#webhookUrl = credentials.webhookUrl;
  }

  async connect(_config: IntegrationPayload): Promise<void> {
    const result = await this.test();
    if (!result.ok) {
      throw new IntegrationConfigError(`Discord connect failed: ${result.message}`, "discord");
    }
  }

  async disconnect(): Promise<void> {
    // Discord webhook tokens can be deleted via the Discord UI or the
    // DELETE /webhooks/{id}/{token} endpoint — app layer responsibility.
  }

  async test(): Promise<TestResult> {
    try {
      // GET on the webhook URL returns the webhook object without posting.
      const safeUrl = await assertSafeEgressUrl(this.#webhookUrl);
      const res = await safeFetch(safeUrl, { method: "GET" });
      if (res.ok) return { ok: true, message: "Webhook reachable" };
      return { ok: false, message: `Discord returned HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: "Discord test error", detail: String(err) };
    }
  }

  async send(event: IntegrationEvent, payload: IntegrationPayload): Promise<DeliveryResult> {
    const fields = Object.entries(payload)
      .filter(([k]) => !k.startsWith("_"))
      .slice(0, 25) // Discord embed max 25 fields
      .map(([k, v]) => ({
        name: k,
        value: String(v ?? "").slice(0, 1024) || "​",
        inline: true,
      }));

    const embed: DiscordEmbed = {
      title: `New submission — ${event}`,
      color: 0x5865f2, // Discord Blurple
      fields,
      timestamp: new Date().toISOString(),
    };

    try {
      const safeUrl = await assertSafeEgressUrl(this.#webhookUrl);
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
      if (res.ok || res.status === 204) return { ok: true };
      const retryable = res.status === 429 || res.status >= 500;
      return { ok: false, retryable, message: `Discord HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, retryable: true, message: "Discord send error", detail: String(err) };
    }
  }
}
