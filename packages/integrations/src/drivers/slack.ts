/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Slack integration driver — sends form submissions as Slack messages via the
 * Incoming Webhooks API or the chat.postMessage Web API.
 *
 * Required credentials (stored encrypted in integrations.credentials):
 *   - webhookUrl  : Slack Incoming Webhook URL (https://hooks.slack.com/services/…)
 *     OR
 *   - botToken    : OAuth Bot Token (xoxb-…) — required when using Web API
 *   - channelId   : Slack channel ID (e.g. C012AB3CD) — only with botToken
 *
 * OAuth scopes needed for botToken:  chat:write, channels:read
 *
 * This file does NOT perform the OAuth flow — that belongs in the app layer.
 * The driver receives already-issued credentials from the encrypted store.
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

interface SlackCredentials {
  readonly webhookUrl?: string;
  readonly botToken?: string;
  readonly channelId?: string;
}

/** Slack Block Kit block for displaying a key/value submission field. */
interface SlackField {
  readonly type: "mrkdwn";
  readonly text: string;
}

export class SlackDriver implements IntegrationProvider {
  readonly permissionExplanation =
    `Grants ${brand.name} permission to post messages to one Slack channel on your behalf. ` +
    "The integration cannot read messages, access DMs, or post to other channels.";

  readonly #credentials: SlackCredentials;

  constructor(credentials: SlackCredentials) {
    if (!credentials.webhookUrl && !credentials.botToken) {
      throw new IntegrationConfigError(
        "Slack driver requires either webhookUrl or botToken",
        "slack",
        "webhookUrl|botToken",
      );
    }
    if (credentials.botToken && !credentials.channelId) {
      throw new IntegrationConfigError(
        "Slack driver requires channelId when using botToken",
        "slack",
        "channelId",
      );
    }
    this.#credentials = credentials;
  }

  async connect(_config: IntegrationPayload): Promise<void> {
    // Validate by running a test ping.
    const result = await this.test();
    if (!result.ok) {
      throw new IntegrationConfigError(
        `Slack connect failed: ${result.message}`,
        "slack",
      );
    }
  }

  async disconnect(): Promise<void> {
    // Webhook URLs cannot be revoked via API. Token revocation for botTokens
    // must be performed via the Slack Web API (auth.revoke) by the app layer.
    // Nothing to do here.
  }

  async test(): Promise<TestResult> {
    try {
      if (this.#credentials.webhookUrl) {
        const safeUrl = await assertSafeEgressUrl(this.#credentials.webhookUrl);
        const res = await safeFetch(safeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `${brand.name} connection test — ignore.` }),
        });
        if (res.ok || res.status === 200) return { ok: true, message: "Webhook reachable" };
        return { ok: false, message: `Slack returned HTTP ${res.status}` };
      }

      // botToken path — call auth.test
      const safeUrl = await assertSafeEgressUrl("https://slack.com/api/auth.test");
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.#credentials.botToken ?? ""}`,
          "Content-Type": "application/json",
        },
      });
      const body = (await res.json()) as Record<string, unknown>;
      if (body["ok"] === true) return { ok: true, message: "Bot token valid" };
      return { ok: false, message: "Slack auth.test failed", detail: String(body["error"] ?? "") };
    } catch (err) {
      return { ok: false, message: "Slack test error", detail: String(err) };
    }
  }

  async send(event: IntegrationEvent, payload: IntegrationPayload): Promise<DeliveryResult> {
    const fields: SlackField[] = Object.entries(payload)
      .filter(([k]) => !k.startsWith("_"))
      .map(([k, v]) => ({ type: "mrkdwn" as const, text: `*${k}*\n${String(v ?? "")}` }));

    const body = {
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `New submission — ${event}`, emoji: false },
        },
        {
          type: "section",
          fields: fields.slice(0, 10), // Slack max 10 fields per section block
        },
      ],
    };

    try {
      if (this.#credentials.webhookUrl) {
        const safeUrl = await assertSafeEgressUrl(this.#credentials.webhookUrl);
        const res = await safeFetch(safeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) return { ok: true };
        // 429 = rate limited, retryable
        const retryable = res.status === 429 || res.status >= 500;
        return { ok: false, retryable, message: `Slack HTTP ${res.status}` };
      }

      // Web API path
      const safeUrl = await assertSafeEgressUrl("https://slack.com/api/chat.postMessage");
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.#credentials.botToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: this.#credentials.channelId, ...body }),
      });
      const result = (await res.json()) as Record<string, unknown>;
      if (result["ok"] === true) return { ok: true, providerRef: String(result["ts"] ?? "") };
      const errorCode = String(result["error"] ?? "unknown");
      const retryable = errorCode === "rate_limited" || res.status >= 500;
      return { ok: false, retryable, message: `Slack API error: ${errorCode}` };
    } catch (err) {
      return { ok: false, retryable: true, message: "Slack send error", detail: String(err) };
    }
  }
}
