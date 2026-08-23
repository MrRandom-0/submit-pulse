/**
 * EmailProvider — the single interface all email drivers implement.
 * Production code must depend on this type, never on a concrete driver.
 */

export interface EmailMessage {
  /** Recipient address. */
  to: string;
  /** Sender address, e.g. brand.email.from. */
  from: string;
  /** Optional sender display name. */
  fromName?: string;
  /** Reply-To address. */
  replyTo?: string;
  subject: string;
  /** Full HTML body. Must be pre-rendered and escaped before passing here. */
  html: string;
  /** Plain-text alternative. Must accompany html. */
  text: string;
  /**
   * Stable idempotency key derived by idempotency.ts.
   * Drivers should forward this as the provider's dedup key where supported.
   */
  idempotencyKey: string;
  /**
   * Optional provider-side tags for analytics and filtering.
   * Examples: { kind: "notification", formId: "fm_xxx" }
   */
  tags?: Record<string, string>;
}

export interface SendResult {
  /** Provider-assigned message ID for correlation with provider dashboards. */
  providerMessageId: string;
  /** ISO timestamp of acceptance by the provider, if returned. */
  acceptedAt?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<SendResult>;
}
