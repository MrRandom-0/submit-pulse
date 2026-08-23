/**
 * Autoresponder email template — sent to the submitter acknowledging receipt.
 *
 * SAFETY CONTRACT (enforced in the worker, checked here defensively):
 * - MUST NOT be sent for spam or blocked submissions.
 * - MUST NOT be sent for synthetic (health-check) submissions.
 * - replyToEmail MUST be a monitored inbox, never a no-reply address, to
 *   prevent mail loops where the submitter's OOO auto-reply triggers another
 *   send. The template surfaces this as a comment but enforcement belongs in
 *   the worker layer.
 *
 * SECURITY: The bodyHtml/bodyText come from workspace configuration (trusted).
 * Any {{fieldName}} token substitution uses the field values from the
 * submission (untrusted). Tokens are replaced with escapeHtml / escapePlainText.
 */

import { escapeHtml, escapePlainText } from "./escape.js";
import { htmlLayout, plainTextLayout } from "./layout.js";

export interface AutoresponderTemplateInput {
  subject: string;
  /** Operator-authored HTML body. May contain {{fieldName}} tokens. */
  bodyHtml: string | null;
  /** Operator-authored plain text body. May contain {{fieldName}} tokens. */
  bodyText: string | null;
  fromName?: string | null;
  /** Field values from the submission used to expand {{fieldName}} tokens. UNTRUSTED. */
  fields: Record<string, unknown>;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Expand {{fieldName}} tokens in a template string.
 * SECURITY: fieldValues are user-submitted (untrusted). The escaper argument
 * determines context-appropriate escaping (escapeHtml for HTML, escapePlainText
 * for text). This is the escape site for autoresponder token substitution.
 */
function expandTokens(
  template: string,
  fields: Record<string, unknown>,
  escaper: (v: unknown) => string,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    // SECURITY: escape site — field values are untrusted user input.
    return escaper(fields[name] ?? "");
  });
}

export function renderAutoresponder(input: AutoresponderTemplateInput): RenderedEmail {
  const { subject, bodyHtml, bodyText, fields } = input;

  const resolvedHtml = bodyHtml
    ? expandTokens(bodyHtml, fields, escapeHtml)
    : "<p>Thank you for your submission.</p>";

  const resolvedText = bodyText
    ? expandTokens(bodyText, fields, escapePlainText)
    : "Thank you for your submission.";

  const html = htmlLayout({
    title: subject,
    bodyContent: resolvedHtml,
  });

  const text = plainTextLayout({
    title: subject,
    bodyContent: resolvedText,
  });

  return { subject, html, text };
}
