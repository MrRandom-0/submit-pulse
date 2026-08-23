// INCOMPLETE — NOT PRODUCTION VERIFIED
// This driver implements the real Resend REST API request shape but has not
// been exercised against a live Resend account. No API key is available in
// this environment. Wire up SP_RESEND_API_KEY, run the integration test suite,
// and remove this comment when production-verified.

import { brand } from "@submitpulse/config";
import type { EmailMessage, EmailProvider, SendResult } from "./provider.js";

const RESEND_API_URL = "https://api.resend.com/emails";

interface ResendSuccessResponse {
  id: string;
}

interface ResendErrorResponse {
  name: string;
  message: string;
  statusCode: number;
}

export class ResendProvider implements EmailProvider {
  private readonly apiKey: string;

  constructor() {
    const envVarName = brand.env.var("RESEND_API_KEY");
    const key = process.env[envVarName];
    if (!key || key.trim() === "") {
      throw new Error(
        `ResendProvider: missing required environment variable ${envVarName}. ` +
          `Set it to your Resend API key (re_*). ` +
          `See https://resend.com/docs/api-reference/introduction for how to obtain one.`,
      );
    }
    this.apiKey = key;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const body = {
      from: message.fromName
        ? `${message.fromName} <${message.from}>`
        : message.from,
      to: [message.to],
      reply_to: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      // Resend accepts idempotency via the Idempotency-Key header (see below).
      // Tags are passed as an array of { name, value } objects.
      tags: message.tags
        ? Object.entries(message.tags).map(([name, value]) => ({ name, value }))
        : undefined,
    };

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        // Forward the idempotency key so Resend deduplicates on its end.
        "Idempotency-Key": message.idempotencyKey,
        "User-Agent": brand.wire.userAgent,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let detail = "(no body)";
      try {
        const err = (await response.json()) as ResendErrorResponse;
        detail = `${err.name}: ${err.message}`;
      } catch {
        // ignore parse failure
      }
      throw new Error(
        `ResendProvider: HTTP ${response.status} from Resend — ${detail}`,
      );
    }

    const result = (await response.json()) as ResendSuccessResponse;
    return {
      providerMessageId: result.id,
      acceptedAt: new Date().toISOString(),
    };
  }
}
