/**
 * Health monitor incident alert email.
 * Sent when Pulse detects a form failure and when it recovers.
 */

import { brand } from "@submitpulse/config";
import { escapeHtml, escapePlainText } from "./escape.js";
import { htmlLayout, plainTextLayout } from "./layout.js";

export type IncidentAlertKind = "opened" | "recovered" | "escalated";

export interface IncidentAlertTemplateInput {
  kind: IncidentAlertKind;
  formName: string;
  formId: string;
  incidentId: string;
  severity: "warning" | "critical";
  /** Short human-readable summary of what failed. */
  failureSummary: string;
  /** ISO timestamp when the incident opened. */
  openedAt: string;
  /** ISO timestamp when recovery was detected (for 'recovered' kind). */
  recoveredAt?: string;
  /** Number of consecutive failing runs. */
  failureCount: number;
  /** URL to view the incident in the app. */
  incidentUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderIncidentAlert(input: IncidentAlertTemplateInput): RenderedEmail {
  const kindLabel =
    input.kind === "opened"
      ? "ALERT"
      : input.kind === "recovered"
        ? "RESOLVED"
        : "ESCALATED";

  const safeForm = escapeHtml(input.formName);
  const safeSummary = escapeHtml(input.failureSummary);
  const safeUrl = escapeHtml(input.incidentUrl);

  const subject = `[${kindLabel}] Form health issue: ${input.formName}`;

  const badgeClass =
    input.kind === "recovered"
      ? "green"
      : input.severity === "critical"
        ? "red"
        : "";

  const html = htmlLayout({
    title: subject,
    preheader: `${kindLabel}: ${input.formName} — ${input.failureSummary}`,
    bodyContent: `
      <h1><span class="badge ${badgeClass}">${kindLabel}</span> Form Health Issue</h1>
      <p>A health check issue was detected for <strong>${safeForm}</strong>.</p>
      <table class="field-table">
        <tbody>
          <tr><th>Status</th><td>${safeForm}</td></tr>
          <tr><th>Summary</th><td>${safeSummary}</td></tr>
          <tr><th>Severity</th><td>${escapeHtml(input.severity)}</td></tr>
          <tr><th>Failing Runs</th><td>${input.failureCount}</td></tr>
          <tr><th>Opened At</th><td>${escapeHtml(input.openedAt)}</td></tr>
          ${input.recoveredAt ? `<tr><th>Recovered At</th><td>${escapeHtml(input.recoveredAt)}</td></tr>` : ""}
        </tbody>
      </table>
      <p><a class="btn" href="${safeUrl}">View Incident</a></p>
    `,
  });

  const text = plainTextLayout({
    title: subject,
    bodyContent: `${kindLabel}: Form Health Issue

Form:     ${escapePlainText(input.formName)}
Summary:  ${escapePlainText(input.failureSummary)}
Severity: ${escapePlainText(input.severity)}
Failures: ${input.failureCount}
Opened:   ${escapePlainText(input.openedAt)}
${input.recoveredAt ? `Recovered: ${escapePlainText(input.recoveredAt)}\n` : ""}
View incident: ${escapePlainText(input.incidentUrl)}`,
  });

  return { subject, html, text };
}
