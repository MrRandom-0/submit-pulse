/**
 * Submission notification email — sent to workspace owners/notification
 * recipients when a new (non-spam, non-synthetic) submission arrives.
 *
 * SECURITY: All submission field values are untrusted input. They are escaped
 * with escapeHtml / escapePlainText at the interpolation site. Do NOT remove
 * or bypass these calls.
 */

import { brand } from "@submitpulse/config";
import { escapeHtml, escapePlainText } from "./escape.js";
import { htmlLayout, plainTextLayout } from "./layout.js";

export interface NotificationTemplateInput {
  formName: string;
  formId: string;
  submissionId: string;
  publicSubmissionId: string;
  /** The field data from the submission. Values are UNTRUSTED. */
  fields: ReadonlyArray<{ label: string; value: unknown }>;
  /** Optional field value to surface as Reply-To name (the submitter's name). */
  submitterName?: string;
  submittedAt: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderNotification(input: NotificationTemplateInput): RenderedEmail {
  // SECURITY: formName comes from workspace config (trusted), but defensively escape anyway.
  const safeFormName = escapeHtml(input.formName);
  const subject = `New submission on ${input.formName}`;
  const submissionUrl = `${brand.domains.app}/submissions/${input.publicSubmissionId}`;

  const fieldRows = input.fields
    .map(({ label, value }) => {
      // SECURITY: label is workspace-configured (semi-trusted), value is user-submitted (untrusted).
      // Both are escaped here as the escape site.
      const safeLabel = escapeHtml(label);
      const safeValue = escapeHtml(value);
      return `<tr><th>${safeLabel}</th><td>${safeValue}</td></tr>`;
    })
    .join("\n");

  const html = htmlLayout({
    title: subject,
    preheader: `New submission on ${input.formName} — received ${input.submittedAt}`,
    bodyContent: `
      <h1>New Submission</h1>
      <p>A new submission was received on <strong>${safeFormName}</strong>.</p>
      ${input.fields.length > 0 ? `
      <table class="field-table">
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>${fieldRows}</tbody>
      </table>` : "<p><em>No fields captured.</em></p>"}
      <p><a class="btn" href="${escapeHtml(submissionUrl)}">View Submission</a></p>
    `,
  });

  // Plain text — escape each field value to prevent header injection.
  const fieldLines = input.fields
    .map(({ label, value }) =>
      // SECURITY: escape site for plain-text interpolation of user-submitted values.
      `${escapePlainText(label)}: ${escapePlainText(value)}`,
    )
    .join("\n");

  const text = plainTextLayout({
    title: subject,
    bodyContent: `New Submission on ${escapePlainText(input.formName)}

${fieldLines || "(no fields)"}

View this submission:
${submissionUrl}`,
  });

  return { subject, html, text };
}
