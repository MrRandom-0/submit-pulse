/**
 * Email address verification template.
 * Sent when a workspace member adds a new notification destination that
 * requires confirmation before receiving submission data.
 */

import { brand } from "@submitpulse/config";
import { escapeHtml, escapePlainText } from "./escape.js";
import { htmlLayout, plainTextLayout } from "./layout.js";

export interface EmailVerificationTemplateInput {
  /** The address being verified. SEMI-TRUSTED (workspace-configured, but validate shape). */
  toEmail: string;
  /** Signed verification URL. */
  verifyUrl: string;
  /** Display name of the form this destination is being added for. */
  formName: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderEmailVerification(
  input: EmailVerificationTemplateInput,
): RenderedEmail {
  const subject = `Confirm your notification address for ${input.formName}`;

  // SECURITY: verifyUrl comes from the server (trusted URL), formName is workspace config.
  // toEmail is displayed only, not used as a link target. Escape defensively.
  const safeFormName = escapeHtml(input.formName);
  const safeVerifyUrl = escapeHtml(input.verifyUrl);
  const safeToEmail = escapeHtml(input.toEmail);

  const html = htmlLayout({
    title: subject,
    preheader: `Confirm ${input.toEmail} to receive submissions from ${input.formName}`,
    bodyContent: `
      <h1>Confirm Your Email Address</h1>
      <p>You (or someone on your team) added <strong>${safeToEmail}</strong> as a notification
      recipient for the form <strong>${safeFormName}</strong> on ${brand.name}.</p>
      <p>Click the button below to confirm this address. The link expires in 24 hours.</p>
      <p><a class="btn" href="${safeVerifyUrl}">Confirm Email Address</a></p>
      <p style="font-size:13px;color:#64748b;">If you did not request this, you can safely ignore this email. No submissions will be sent until the address is confirmed.</p>
    `,
  });

  const text = plainTextLayout({
    title: subject,
    bodyContent: `Confirm Your Email Address

You (or someone on your team) added ${escapePlainText(input.toEmail)} as a notification
recipient for the form "${escapePlainText(input.formName)}" on ${brand.name}.

Confirm your address by visiting:
${escapePlainText(input.verifyUrl)}

This link expires in 24 hours. If you did not request this, ignore this email.`,
  });

  return { subject, html, text };
}
