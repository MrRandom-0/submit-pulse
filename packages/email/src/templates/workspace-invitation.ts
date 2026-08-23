/**
 * Workspace invitation email.
 * Sent when a workspace owner invites a collaborator.
 */

import { brand } from "@submitpulse/config";
import { escapeHtml, escapePlainText } from "./escape.js";
import { htmlLayout, plainTextLayout } from "./layout.js";

export interface WorkspaceInvitationTemplateInput {
  /** Display name of the workspace. TRUSTED (workspace-configured). */
  workspaceName: string;
  /** Display name of the inviting user. TRUSTED. */
  inviterName: string;
  /** Email of the inviting user. TRUSTED. */
  inviterEmail: string;
  /** Signed invitation acceptance URL. TRUSTED. */
  acceptUrl: string;
  /** Role being granted. */
  role: string;
  /** Hours until the invitation expires. */
  expiresInHours: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderWorkspaceInvitation(
  input: WorkspaceInvitationTemplateInput,
): RenderedEmail {
  const subject = `${input.inviterName} invited you to ${input.workspaceName} on ${brand.name}`;

  // SECURITY: All values here come from workspace metadata (trusted). Escape
  // defensively in case a workspace name contains special characters.
  const safeWorkspace = escapeHtml(input.workspaceName);
  const safeInviter = escapeHtml(input.inviterName);
  const safeInviterEmail = escapeHtml(input.inviterEmail);
  const safeAcceptUrl = escapeHtml(input.acceptUrl);
  const safeRole = escapeHtml(input.role);

  const html = htmlLayout({
    title: subject,
    preheader: `${input.inviterName} has invited you to join ${input.workspaceName}`,
    bodyContent: `
      <h1>You're Invited</h1>
      <p><strong>${safeInviter}</strong> (<a href="mailto:${safeInviterEmail}">${safeInviterEmail}</a>)
      has invited you to join the <strong>${safeWorkspace}</strong> workspace on ${brand.name} as
      <span class="badge">${safeRole}</span>.</p>
      <p><a class="btn" href="${safeAcceptUrl}">Accept Invitation</a></p>
      <p style="font-size:13px;color:#64748b;">This invitation expires in ${input.expiresInHours} hours.
      If you were not expecting this invitation, you can safely ignore it.</p>
    `,
  });

  const text = plainTextLayout({
    title: subject,
    bodyContent: `You're Invited

${escapePlainText(input.inviterName)} (${escapePlainText(input.inviterEmail)}) has invited you
to join "${escapePlainText(input.workspaceName)}" on ${brand.name} as ${escapePlainText(input.role)}.

Accept the invitation:
${escapePlainText(input.acceptUrl)}

This invitation expires in ${input.expiresInHours} hours.`,
  });

  return { subject, html, text };
}
