/**
 * INTEGRATION PROMPT GENERATOR
 * ============================
 * Generates paste-into-your-AI-tool prompts that actually work.
 *
 * SECURITY INVARIANT — enforced structurally:
 *   The functions in this module accept NO parameter that could carry a secret.
 *   PromptContext intentionally omits: apiKey, managementKey, sessionToken,
 *   installationToken, and any other credential. The endpoint URL is public by
 *   design; no secret is needed or permitted in a generated prompt. This
 *   comment and the type signature together make it structurally impossible to
 *   emit a secret: there is no field to read one from.
 *
 * Brand strings must come from the brand module, never be hardcoded.
 */

import { brand } from "./brand.js";
import { BUILDERS, type BuilderId } from "./builders.js";
import { generateSnippet, type FormFieldSpec } from "./snippets.js";

// Re-export so consumers only need this module.
export type { FormFieldSpec };

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * All context needed to produce an integration prompt.
 *
 * SECURITY: Do NOT add apiKey, managementKey, sessionToken, installationToken,
 * or any other credential field to this interface. The endpoint is public;
 * no secret is required or permitted.
 */
export interface PromptContext {
  /** Human-readable form name, e.g. "Contact Us". */
  readonly formName: string;
  /** The opaque public form identifier, e.g. "fm_a8f3...". */
  readonly publicFormId: string;
  /** Fully qualified submission endpoint URL. */
  readonly endpoint: string;
  /** Ordered field specifications exactly as the schema declares them. */
  readonly fields: readonly FormFieldSpec[];
  /**
   * Allowed origin for CORS, e.g. "https://example.com". Null when the form
   * allows any origin (not recommended for production).
   */
  readonly allowedOrigin: string | null;
  /** Whether Cloudflare Turnstile CAPTCHA is enabled on this form. */
  readonly captchaEnabled: boolean;
  /** Whether this form accepts file uploads. */
  readonly hasFileUpload: boolean;
  /** The tool the user built their site with. */
  readonly builder: BuilderId;
}

/**
 * Evidence of a mismatch between the deployed form and the declared schema.
 * The repair prompt leads with this evidence to focus the AI's change.
 */
export interface DriftEvidence {
  /** Field name found in the live HTTP request. */
  readonly deployedFieldName: string;
  /** Field name the schema actually expects. */
  readonly expectedFieldName: string;
  /** Optional human-readable description of the mismatch source or context. */
  readonly context?: string | undefined;
}

/**
 * A scanner issue — a structural or accessibility problem found by automated
 * analysis of the deployed form.
 */
export interface ScannerIssue {
  /** Short machine-readable issue code, e.g. "missing-aria-label". */
  readonly code: string;
  /** Human-readable description of what is wrong. */
  readonly description: string;
  /** Optional selector or location where the issue was found. */
  readonly location?: string | undefined;
  /** Optional suggested fix text. */
  readonly suggestedFix?: string | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function fieldList(fields: readonly FormFieldSpec[]): string {
  return fields
    .map((f) => {
      const req = f.required ? " (required)" : " (optional)";
      const label = f.label ? ` — label "${f.label}"` : "";
      return `  - ${f.name}: ${f.type}${req}${label}`;
    })
    .join("\n");
}

function securityNote(hasEnvVars: boolean): string {
  if (hasEnvVars) {
    return (
      `The form endpoint URL is public — it carries no secret and should NOT be ` +
      `stored in an environment variable. Do not invent or request API keys; ` +
      `${brand.name} authenticates submissions by domain, not by a shared secret ` +
      `embedded in client code.`
    );
  }
  return (
    `No environment variable is needed. The endpoint URL is public by design and ` +
    `carries no secret. Do not add a key, token, or credential of any kind.`
  );
}

function originNote(allowedOrigin: string | null): string {
  if (allowedOrigin === null) {
    return `Allowed origin: any (the form currently allows all origins).`;
  }
  return (
    `Allowed origin: ${allowedOrigin}. The form will reject cross-origin requests ` +
    `from any other domain. Ensure the integration runs on the expected origin.`
  );
}

function captchaNote(captchaEnabled: boolean): string {
  if (!captchaEnabled) return "";
  return (
    `\nCAPTCHA: This form requires a Cloudflare Turnstile token. Include the ` +
    `rendered token as the field "cf-turnstile-response" in every submission. ` +
    `Submissions without a valid token will be rejected with HTTP 422.`
  );
}

function fileUploadNote(hasFileUpload: boolean): string {
  if (!hasFileUpload) return "";
  return (
    `\nFile uploads: This form accepts file attachments. POST using multipart/form-data ` +
    `(FormData), not JSON. Do not set a Content-Type header manually — the browser ` +
    `sets the correct boundary automatically.`
  );
}

function visualEditorInstructions(ctx: PromptContext): string {
  const profile = BUILDERS[ctx.builder];
  const caveatBlock =
    profile.caveats.length > 0
      ? `\nEditor-specific notes:\n${profile.caveats.map((c) => `  - ${c}`).join("\n")}`
      : "";

  const captchaLine = ctx.captchaEnabled
    ? `\n- Add a Cloudflare Turnstile widget. The token must be submitted as ` +
      `"cf-turnstile-response" alongside the other fields.`
    : "";

  const originLine = ctx.allowedOrigin
    ? `\n- The form is restricted to origin: ${ctx.allowedOrigin}. Publish your site to that domain before testing.`
    : "";

  return (
    `Configure the "${ctx.formName}" form in ${profile.label}\n` +
    `${"=".repeat(60)}\n\n` +
    `${profile.label} does not have a coding agent. Follow these configuration steps ` +
    `inside the ${profile.label} editor:\n\n` +
    `1. Select the form element for "${ctx.formName}".\n` +
    `2. Set the form action / POST URL to:\n\n` +
    `   ${ctx.endpoint}\n\n` +
    `3. Set the method to POST.\n` +
    `4. Ensure the field names exactly match the schema below. Rename any that differ.\n\n` +
    `Required field names and types:\n${fieldList(ctx.fields)}\n` +
    `${originLine}${captchaLine}\n\n` +
    `${securityNote(profile.hasEnvVars)}\n` +
    `\ndocs: ${brand.domains.docs}${caveatBlock}`
  );
}

function fileTargetNote(
  understandsRepoWideInstruction: boolean,
  formName: string,
): string {
  if (understandsRepoWideInstruction) return "";
  return (
    `\nIMPORTANT — scope: This agent sees only the currently open file. Before ` +
    `pasting this prompt, open the component or file that renders the ` +
    `"${formName}" form. Do not apply changes to any other file.`
  );
}

// ---------------------------------------------------------------------------
// generateIntegrationPrompt
// ---------------------------------------------------------------------------

/**
 * Generate a prompt the user pastes into their AI tool to wire up the form.
 *
 * SECURITY: This function does not accept and will never emit API keys,
 * management keys, session tokens, or installation tokens. The function
 * signature makes this structurally impossible — PromptContext has no such
 * field. Do not modify the signature to add one.
 */
export function generateIntegrationPrompt(ctx: PromptContext): string {
  const profile = BUILDERS[ctx.builder];

  // Visual editors (Framer, Webflow) have no coding agent — produce
  // configuration instructions rather than a coding prompt.
  if (profile.surface === "visual_editor") {
    return visualEditorInstructions(ctx);
  }

  const snippet = generateSnippet({
    flavour: profile.snippetFlavour,
    endpoint: ctx.endpoint,
    fields: ctx.fields,
    captchaEnabled: ctx.captchaEnabled,
    hasFileUpload: ctx.hasFileUpload,
  });

  const caveatBlock =
    profile.caveats.length > 0
      ? `\nBuilder-specific notes:\n${profile.caveats.map((c) => `  - ${c}`).join("\n")}\n`
      : "";

  const scopeNote = fileTargetNote(profile.understandsRepoWideInstruction, ctx.formName);

  return (
    `Wire up the "${ctx.formName}" form to ${brand.name}\n` +
    `${"=".repeat(60)}\n\n` +
    `Task: Integrate the existing "${ctx.formName}" form so it POSTs submissions ` +
    `to the ${brand.name} endpoint below. Do not redesign, restyle, or restructure ` +
    `the form — preserve the existing layout and visual design exactly.\n` +
    `${scopeNote}\n\n` +
    `Endpoint\n` +
    `--------\n` +
    `${ctx.endpoint}\n\n` +
    `Field schema (use these exact names — any mismatch silently drops data)\n` +
    `------------------------------------------------------------------------\n` +
    `${fieldList(ctx.fields)}\n\n` +
    `${originNote(ctx.allowedOrigin)}\n` +
    `${captchaNote(ctx.captchaEnabled)}` +
    `${fileUploadNote(ctx.hasFileUpload)}\n\n` +
    `Security\n` +
    `--------\n` +
    `${securityNote(profile.hasEnvVars)}\n\n` +
    `Requirements (implement all of these)\n` +
    `-------------------------------------\n` +
    `1. Preserve the existing design — no layout, colour, or font changes.\n` +
    `2. POST to the endpoint above with the exact field names listed.\n` +
    `3. Do NOT expose or invent credentials of any kind.\n` +
    `4. Add a loading state: disable the submit button and show progress while the request is in flight.\n` +
    `5. Add accessible validation: associate labels with inputs, use aria-invalid and aria-describedby on error, show inline error messages.\n` +
    `6. Handle error responses: read the API's structured error shape ({ error?: string; message?: string }) and display the message to the user.\n` +
    `7. Show a success state after a 2xx response.\n` +
    `8. Prevent duplicate submissions: ignore further submit events while a request is in flight.\n` +
    `9. Test the integration: submit the form and confirm a 2xx response in the browser network tab.\n\n` +
    `${caveatBlock}` +
    `Reference implementation\n` +
    `------------------------\n` +
    `The snippet below is a complete, working implementation for the ` +
    `${profile.label} environment. Use it as a reference or starting point — ` +
    `adapt to match the existing component structure rather than replacing it wholesale.\n\n` +
    `\`\`\`\n${snippet}\`\`\`\n\n` +
    `docs: ${brand.domains.docs}`
  );
}

// ---------------------------------------------------------------------------
// generateRepairPrompt
// ---------------------------------------------------------------------------

/**
 * Generate a prompt that repairs a specific schema drift between the deployed
 * form and the declared field schema.
 *
 * SECURITY: No credential is accepted or emitted. See PromptContext.
 */
export function generateRepairPrompt(
  ctx: PromptContext & { readonly drift: DriftEvidence },
): string {
  const profile = BUILDERS[ctx.builder];
  const { drift } = ctx;
  const scopeNote = fileTargetNote(profile.understandsRepoWideInstruction, ctx.formName);

  const contextLine =
    drift.context != null ? `\nAdditional context: ${drift.context}` : "";

  return (
    `Repair field name mismatch in the "${ctx.formName}" form\n` +
    `${"=".repeat(60)}\n\n` +
    `Evidence of mismatch:\n` +
    `  Your deployed "${ctx.formName}" form currently sends the field ` +
    `"${drift.deployedFieldName}", but the ${brand.name} schema expects ` +
    `"${drift.expectedFieldName}".${contextLine}\n\n` +
    `Fix:\n` +
    `  Rename every reference to "${drift.deployedFieldName}" in the form ` +
    `integration to "${drift.expectedFieldName}". This includes: the input's ` +
    `name attribute (or v-model/bind key), the FormData/JSON key, and any ` +
    `TypeScript type or interface that names the field.\n\n` +
    `Scope:\n` +
    `  Update ONLY the "${ctx.formName}" form integration. Do not refactor ` +
    `unrelated code, rename other fields, or alter the form's visual design.` +
    `${scopeNote}\n\n` +
    `Endpoint: ${ctx.endpoint}\n\n` +
    `Full field schema for reference:\n${fieldList(ctx.fields)}\n\n` +
    `After making the change, submit the form and confirm the network request ` +
    `uses "${drift.expectedFieldName}" — not "${drift.deployedFieldName}".`
  );
}

// ---------------------------------------------------------------------------
// generateScannerFixPrompt
// ---------------------------------------------------------------------------

/**
 * Generate a prompt that fixes a specific issue found by automated scanning.
 *
 * SECURITY: No credential is accepted or emitted. See PromptContext.
 */
export function generateScannerFixPrompt(
  ctx: PromptContext & { readonly issue: ScannerIssue },
): string {
  const profile = BUILDERS[ctx.builder];
  const { issue } = ctx;
  const scopeNote = fileTargetNote(profile.understandsRepoWideInstruction, ctx.formName);

  const locationLine =
    issue.location != null
      ? `\nLocation: ${issue.location}`
      : "";

  const fixLine =
    issue.suggestedFix != null
      ? `\nSuggested fix: ${issue.suggestedFix}`
      : "";

  const caveatBlock =
    profile.caveats.length > 0
      ? `\nBuilder-specific notes:\n${profile.caveats.map((c) => `  - ${c}`).join("\n")}\n`
      : "";

  return (
    `Fix scanner issue in the "${ctx.formName}" form [${issue.code}]\n` +
    `${"=".repeat(60)}\n\n` +
    `Issue detected by ${brand.name} scanner:\n` +
    `  Code: ${issue.code}\n` +
    `  Description: ${issue.description}` +
    `${locationLine}${fixLine}\n\n` +
    `Task:\n` +
    `  Fix the issue described above in the "${ctx.formName}" form. ` +
    `Do not alter the form's visual design, field names, submission logic, ` +
    `or any code outside the "${ctx.formName}" form integration.` +
    `${scopeNote}\n\n` +
    `Endpoint: ${ctx.endpoint}\n` +
    `Field schema:\n${fieldList(ctx.fields)}\n\n` +
    `${caveatBlock}` +
    `After applying the fix, verify that the form still submits successfully ` +
    `to ${ctx.endpoint} with a 2xx response.`
  );
}
