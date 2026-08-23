/**
 * ConsoleEmailProvider — development-only driver.
 *
 * Renders the full message to stdout so developers can inspect email output
 * without an outbound connection. Construction is guarded: if NODE_ENV is
 * "production" the constructor throws so a misconfiguration cannot silently
 * swallow production email traffic.
 */

import type { EmailMessage, EmailProvider, SendResult } from "./provider.js";

export class ConsoleEmailProvider implements EmailProvider {
  constructor() {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error(
        "ConsoleEmailProvider must not be used in production. " +
          "Configure a real email provider via the SP_RESEND_API_KEY env var.",
      );
    }
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const fakeId = `console_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const separator = "─".repeat(72);

    console.log(`\n${separator}`);
    console.log(`[ConsoleEmailProvider] OUTBOUND EMAIL`);
    console.log(separator);
    console.log(`  To:             ${message.to}`);
    console.log(`  From:           ${message.fromName ? `${message.fromName} <${message.from}>` : message.from}`);
    if (message.replyTo) {
      console.log(`  Reply-To:       ${message.replyTo}`);
    }
    console.log(`  Subject:        ${message.subject}`);
    console.log(`  IdempotencyKey: ${message.idempotencyKey}`);
    if (message.tags && Object.keys(message.tags).length > 0) {
      console.log(`  Tags:           ${JSON.stringify(message.tags)}`);
    }
    console.log(`\n--- HTML Body ---\n${message.html}`);
    console.log(`\n--- Text Body ---\n${message.text}`);
    console.log(`${separator}\n`);

    return {
      providerMessageId: fakeId,
      acceptedAt: new Date().toISOString(),
    };
  }
}
