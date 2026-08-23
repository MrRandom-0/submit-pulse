/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Telegram integration driver — sends form submissions as Telegram messages via
 * the Bot API (sendMessage endpoint).
 *
 * Required credentials (stored encrypted in integrations.credentials):
 *   - botToken : Telegram Bot token issued by @BotFather (123456:ABC-DEF…)
 *   - chatId   : Target chat or group ID (numeric string, e.g. "-1001234567890")
 *
 * The bot must be added to the target chat/group and have permission to send
 * messages. The chatId for a public group can be found via getUpdates after
 * sending the bot a test message.
 *
 * Note: Telegram API does not require SSRF-guarding here since the endpoint is
 * a fixed Telegram hostname, but assertSafeEgressUrl is still called for
 * defence-in-depth and consistency with other drivers.
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

interface TelegramCredentials {
  readonly botToken: string;
  readonly chatId: string;
}

export class TelegramDriver implements IntegrationProvider {
  readonly permissionExplanation =
    `Grants ${brand.name} permission to send messages to one Telegram chat or ` +
    "group using a Bot you create and control. The bot cannot read existing " +
    "messages, access other chats, or perform any action beyond sending messages.";

  readonly #botToken: string;
  readonly #chatId: string;

  constructor(credentials: TelegramCredentials) {
    if (!credentials.botToken) {
      throw new IntegrationConfigError("Telegram driver requires botToken", "telegram", "botToken");
    }
    if (!credentials.chatId) {
      throw new IntegrationConfigError("Telegram driver requires chatId", "telegram", "chatId");
    }
    this.#botToken = credentials.botToken;
    this.#chatId = credentials.chatId;
  }

  #apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.#botToken}/${method}`;
  }

  async connect(_config: IntegrationPayload): Promise<void> {
    const result = await this.test();
    if (!result.ok) {
      throw new IntegrationConfigError(`Telegram connect failed: ${result.message}`, "telegram");
    }
  }

  async disconnect(): Promise<void> {
    // Bot tokens are revoked via @BotFather — app layer responsibility.
  }

  async test(): Promise<TestResult> {
    try {
      const safeUrl = await assertSafeEgressUrl(this.#apiUrl("getMe"));
      const res = await safeFetch(safeUrl, { method: "GET" });
      const body = (await res.json()) as Record<string, unknown>;
      if (body["ok"] === true) return { ok: true, message: "Bot token valid" };
      return {
        ok: false,
        message: "Telegram getMe failed",
        detail: String(body["description"] ?? ""),
      };
    } catch (err) {
      return { ok: false, message: "Telegram test error", detail: String(err) };
    }
  }

  async send(event: IntegrationEvent, payload: IntegrationPayload): Promise<DeliveryResult> {
    // Telegram supports MarkdownV2; use HTML parse_mode to avoid escaping complexity.
    const fieldLines = Object.entries(payload)
      .filter(([k]) => !k.startsWith("_"))
      .map(([k, v]) => `<b>${escapeHtml(k)}</b>: ${escapeHtml(String(v ?? ""))}`)
      .join("\n");

    const text = `<b>New submission</b> — ${escapeHtml(event)}\n\n${fieldLines}`;

    try {
      const safeUrl = await assertSafeEgressUrl(this.#apiUrl("sendMessage"));
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.#chatId,
          text: text.slice(0, 4096), // Telegram max message length
          parse_mode: "HTML",
        }),
      });
      const body = (await res.json()) as Record<string, unknown>;
      if (body["ok"] === true) {
        const messageId = (body["result"] as Record<string, unknown> | undefined)?.["message_id"];
        return { ok: true, providerRef: String(messageId ?? "") };
      }
      const errCode = Number((body["error_code"] as number | undefined) ?? 0);
      const retryable = errCode === 429 || errCode >= 500;
      return {
        ok: false,
        retryable,
        message: `Telegram error ${errCode}`,
        detail: String(body["description"] ?? ""),
      };
    } catch (err) {
      return { ok: false, retryable: true, message: "Telegram send error", detail: String(err) };
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
