/**
 * WEBSITE FORM SCANNER — analyze.ts
 * ==================================
 * Given a user-supplied page URL, fetch the page HTML and analyse any forms
 * found within it for structural, security, and accessibility issues.
 *
 * SSRF NOTICE: This function fetches USER-SUPPLIED URLs — that is intentional
 * (scanner is scanning the user's own site) but must be guarded. We call
 * assertSafeEgressUrl before any fetch and re-validate after each redirect.
 * `safeFetch` in @submitpulse/security handles redirect-chain validation.
 *
 * DNS REBINDING WARNING (see packages/security/src/ssrf.ts):
 * Passing DNS hostname checks here does NOT guarantee safety at connect time.
 * A malicious DNS server can serve a safe IP during our check and switch to a
 * private IP at connection time (DNS rebinding). The platform-level egress
 * policy provides a second layer, but we cannot rely on it in all deployments.
 * If this scanner runs in a context without a platform egress policy, consider
 * pre-resolving the hostname with a trusted resolver and pinning the connection
 * to the resolved IP.
 *
 * HTML PARSING DISCLAIMER:
 * We use focused regex / string scanning rather than a full DOM parser. This
 * is a deliberate trade-off — it avoids a heavy native dependency and works on
 * a server-side fetch. Limitations:
 *   - Does NOT handle deeply nested or dynamically injected forms.
 *   - Attribute parsing handles common quoting styles (double, single, none)
 *     but may mis-parse exotic or intentionally malformed HTML.
 *   - JavaScript-rendered forms (React, Angular, etc.) are NOT visible here;
 *     the static HTML is scanned, so results reflect the server-rendered markup.
 * These limitations are stated upfront, not papered over.
 */

import {
  assertSafeEgressUrl,
  safeFetch,
  SsrfError,
} from "@submitpulse/security";
import { makeScanIssue, ISSUE_CODES, type ScanIssue } from "./issues.js";
import type { PromptContext } from "@submitpulse/config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum response body we will read, in bytes (1 MB). */
const MAX_BODY_BYTES = 1_048_576;

/** Fetch timeout, in milliseconds. */
const FETCH_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FormInfo {
  /** Zero-based index of this form in the page. */
  index: number;
  /** Raw action attribute value (may be relative). */
  action: string | null;
  /** Normalised absolute action URL, or null if unresolvable. */
  absoluteAction: string | null;
  /** form method, uppercased. Defaults to "GET" per HTML spec if absent. */
  method: string;
  /** enctype attribute value. */
  enctype: string | null;
  /** Raw outer HTML of the <form> element (truncated to 4 KB for evidence). */
  rawHtml: string;
  /** Parsed field descriptors. */
  fields: FieldInfo[];
  /** Does the page HTML appear to have success-state indicators? */
  hasSuccessState: boolean;
  /** Does the page HTML appear to have error-state indicators? */
  hasErrorState: boolean;
  /** Does the page HTML appear to have loading-state indicators? */
  hasLoadingState: boolean;
  /** Does the page include a known CAPTCHA widget? */
  hasCaptcha: boolean;
}

export interface FieldInfo {
  name: string | null;
  type: string;
  label: string | null;
  required: boolean;
  hasAriaLabel: boolean;
  hasAutocomplete: boolean;
  placeholder: string | null;
  /** Raw HTML of the input element (truncated). */
  rawHtml: string;
}

export interface ScanResult {
  /** Original URL supplied by the user. */
  url: string;
  /** HTTP status code of the page fetch. */
  httpStatus: number;
  /** Whether at least one form was found. */
  formFound: boolean;
  /** Parsed form descriptors (one per <form> tag). */
  forms: FormInfo[];
  /** All issues found across all forms, ordered by severity. */
  issues: ScanIssue[];
  /** ISO timestamp of the scan. */
  scannedAt: string;
  /** Whether the scan was blocked by an SSRF guard. */
  ssrfBlocked: boolean;
  /** SSRF block reason if blocked. */
  ssrfReason?: string | undefined;
}

// ---------------------------------------------------------------------------
// HTML extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract the first occurrence of an attribute from a tag string.
 * Handles double-quoted, single-quoted, and unquoted attribute values.
 *
 * Example: extractAttr('<form action="/submit" method="post">', 'action')
 *   => "/submit"
 *
 * LIMITATION: Does not handle attributes with embedded quotes or complex
 * whitespace. Good enough for well-formed real-world HTML.
 */
function extractAttr(tag: string, attr: string): string | null {
  // Prefer double-quoted, then single-quoted, then unquoted.
  const patterns = [
    new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, "i"),
    new RegExp(`\\b${attr}\\s*=\\s*'([^']*)'`, "i"),
    new RegExp(`\\b${attr}\\s*=\\s*([^\\s>'"]+)`, "i"),
    new RegExp(`\\b${attr}(?:\\s|>|$)`, "i"), // bare attribute (no value)
  ];

  for (const pattern of patterns) {
    const m = pattern.exec(tag);
    if (m !== null) {
      return m[1] ?? ""; // bare attr → empty string
    }
  }
  return null;
}

/**
 * Extract the text content of a <label for="id"> or wrapping <label> that
 * corresponds to the given field name/id.
 *
 * LIMITATION: Only handles explicit for= associations and basic wrapping
 * labels. Implicit associations via proximity are not detected.
 */
function findLabelForField(html: string, fieldName: string | null, fieldId: string | null): string | null {
  if (fieldName === null && fieldId === null) return null;

  // Try <label for="…"> matching either id or name attribute.
  const candidates = [fieldId, fieldName].filter((v): v is string => v !== null);
  for (const candidate of candidates) {
    const forPattern = new RegExp(
      `<label[^>]+for\\s*=\\s*["']?${candidate}["']?[^>]*>(.*?)</label>`,
      "is",
    );
    const m = forPattern.exec(html);
    if (m?.[1] !== undefined) {
      // Strip inner HTML tags to get text content.
      return m[1].replace(/<[^>]+>/g, "").trim() || null;
    }
  }
  return null;
}

/**
 * Extract all <form> HTML blocks from the page.
 * Returns raw strings of the form element's outer HTML.
 *
 * LIMITATION: Nested forms are invalid HTML and are not handled. We find
 * each <form … > opening tag and scan forward for the matching </form>,
 * which fails on malformed markup with unbalanced tags.
 */
function extractFormBlocks(html: string): string[] {
  const blocks: string[] = [];
  // Find all <form …> openings (case-insensitive).
  const formOpenRe = /<form(?:\s[^>]*)?>(?!\s*<\/form>)/gi;
  let match: RegExpExecArray | null;

  while ((match = formOpenRe.exec(html)) !== null) {
    const startIdx = match.index;
    // Find the closing </form> that follows.
    const closeIdx = html.toLowerCase().indexOf("</form>", startIdx);
    if (closeIdx === -1) {
      // No closing tag — grab up to the end (handles unclosed forms).
      blocks.push(html.slice(startIdx));
    } else {
      blocks.push(html.slice(startIdx, closeIdx + "</form>".length));
    }
  }
  return blocks;
}

/**
 * Extract all <input>, <textarea>, and <select> elements from a form block.
 */
function extractFields(formHtml: string): FieldInfo[] {
  const fields: FieldInfo[] = [];

  // Match self-closing and paired elements. We capture the opening tag.
  const fieldRe = /<(input|textarea|select)(\s[^>]*)?(?:\/>|>)/gi;
  let m: RegExpExecArray | null;

  while ((m = fieldRe.exec(formHtml)) !== null) {
    const tag = m[0] ?? "";
    const elType = (m[1] ?? "input").toLowerCase();
    const rawHtml = tag.slice(0, 512); // truncate evidence

    const type = extractAttr(tag, "type") ?? (elType === "input" ? "text" : elType);
    const name = extractAttr(tag, "name");
    const id = extractAttr(tag, "id");
    const placeholder = extractAttr(tag, "placeholder");
    const autocomplete = extractAttr(tag, "autocomplete");
    const hasAriaLabel =
      extractAttr(tag, "aria-label") !== null ||
      extractAttr(tag, "aria-labelledby") !== null;
    const requiredAttr = extractAttr(tag, "required");
    const required =
      requiredAttr !== null ||
      /\brequired\b/i.test(tag);

    const label = findLabelForField(formHtml, name, id);

    fields.push({
      name,
      type,
      label,
      required,
      hasAriaLabel,
      hasAutocomplete: autocomplete !== null,
      placeholder,
      rawHtml,
    });
  }
  return fields;
}

/**
 * Detect potential secrets leaked into markup (e.g. API keys in hidden inputs
 * or data attributes). This is heuristic — we flag patterns that look like
 * keys; we do NOT guarantee correctness.
 *
 * Returns an array of [evidence_snippet, description] tuples.
 */
function detectLeakedSecrets(html: string): Array<[string, string]> {
  const findings: Array<[string, string]> = [];

  // Hidden inputs with names commonly used for API keys / tokens.
  const suspiciousNameRe = /<input[^>]+type\s*=\s*["']?hidden["']?[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = suspiciousNameRe.exec(html)) !== null) {
    const tag = m[0] ?? "";
    const name = (extractAttr(tag, "name") ?? "").toLowerCase();
    const value = extractAttr(tag, "value") ?? "";

    // Flag common secret field names with non-trivial values.
    if (
      /key|secret|token|apikey|api_key|auth|password|credential/i.test(name) &&
      value.length > 8
    ) {
      findings.push([tag.slice(0, 256), `Hidden input named "${name}" carries a value that resembles a secret.`]);
    }
  }

  // Inline script blocks containing suspicious patterns.
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = scriptRe.exec(html)) !== null) {
    const script = m[1] ?? "";
    // Look for common patterns: sk_live_, pk_live_, api_key =, etc.
    const secretPatterns = [
      /sk_live_[A-Za-z0-9]{10,}/,
      /pk_live_[A-Za-z0-9]{10,}/,
      /AIza[A-Za-z0-9\-_]{30,}/,   // Google API key pattern
      /xox[bpsa]-[A-Za-z0-9\-]{20,}/, // Slack token
      /['"]api[_-]?key['"]\s*:\s*['"][A-Za-z0-9\-_]{16,}/i,
    ];
    for (const pat of secretPatterns) {
      const hit = pat.exec(script);
      if (hit !== null) {
        findings.push([
          hit[0].slice(0, 120),
          "Inline script appears to contain a hardcoded API key or secret.",
        ]);
      }
    }
  }

  return findings;
}

/**
 * Detect CAPTCHA presence in page HTML.
 * Looks for Cloudflare Turnstile, hCaptcha, and reCAPTCHA patterns.
 */
function detectCaptcha(html: string): boolean {
  return (
    /turnstile\.cloudflare\.com/i.test(html) ||
    /cf-turnstile/i.test(html) ||
    /hcaptcha\.com/i.test(html) ||
    /h-captcha/i.test(html) ||
    /recaptcha/i.test(html) ||
    /grecaptcha/i.test(html)
  );
}

/**
 * Crude detection of success / error / loading state patterns.
 * Looks for common class names, aria roles, and text patterns.
 * LIMITATION: Misses purely JS-rendered states. Documents this accurately.
 */
function detectStates(html: string): {
  hasSuccessState: boolean;
  hasErrorState: boolean;
  hasLoadingState: boolean;
} {
  const lower = html.toLowerCase();
  return {
    hasSuccessState:
      /success|thank.?you|submitted|confirmation|sent/i.test(lower) ||
      /role\s*=\s*["']?alert["']?/i.test(html),
    hasErrorState:
      /error|invalid|failed|required|alert-danger|text-red|text-error/i.test(lower) ||
      /aria-invalid/i.test(html),
    hasLoadingState:
      /loading|spinner|submitting|pending/i.test(lower) ||
      /aria-busy/i.test(html),
  };
}

// ---------------------------------------------------------------------------
// Issue generation
// ---------------------------------------------------------------------------

function collectIssues(
  pageUrl: string,
  pageHtml: string,
  forms: FormInfo[],
  ctx: PromptContext,
): ScanIssue[] {
  const issues: ScanIssue[] = [];

  // No form found at all
  if (forms.length === 0) {
    issues.push(
      makeScanIssue(
        {
          code: ISSUE_CODES.NO_FORM_FOUND,
          title: "No HTML form detected",
          explanation:
            "The scanner could not find a <form> element in the static HTML of this page. " +
            "This may be because the form is rendered client-side (React, Vue, Angular) " +
            "and not present in the initial server response. " +
            "Other checks cannot run without a form element.",
          evidence: `URL fetched: ${pageUrl} — no <form> tag found in ${pageHtml.length}-byte HTML response.`,
          recommendedFix:
            "Ensure the form is rendered in the initial HTML response (server-side rendering) " +
            "so the scanner can analyse it. If client-side only, test manually.",
          severity: "Warning",
          location: pageUrl,
        },
        ctx,
      ),
    );
    return issues;
  }

  for (const form of forms) {
    const loc = `form[${form.index}]${form.action ? ` action="${form.action}"` : ""}`;

    // Method GET is a Critical issue for forms that submit data.
    if (form.method === "GET") {
      issues.push(
        makeScanIssue(
          {
            code: ISSUE_CODES.METHOD_GET,
            title: "Form uses GET method — data exposed in URL",
            explanation:
              "The form uses HTTP GET, which appends all field values to the URL query string. " +
              "This exposes submitted data in browser history, server access logs, referrer " +
              "headers, and any proxies in between. Use POST for any form that collects user data.",
            evidence: form.rawHtml.slice(0, 512),
            recommendedFix: 'Change the form method attribute to method="post".',
            severity: "Critical",
            location: loc,
          },
          ctx,
        ),
      );
    }

    // Non-HTTPS action URL
    if (
      form.absoluteAction !== null &&
      !form.absoluteAction.startsWith("https://")
    ) {
      issues.push(
        makeScanIssue(
          {
            code: ISSUE_CODES.NO_HTTPS_ACTION,
            title: "Form action URL is not HTTPS",
            explanation:
              "The form submits to an HTTP (non-TLS) endpoint. Submitted data travels in " +
              "plaintext and can be intercepted by network observers (man-in-the-middle). " +
              "All form endpoints must use HTTPS.",
            evidence: `action="${form.absoluteAction}"`,
            recommendedFix:
              "Update the form action to use https://. Ensure the server has a valid TLS certificate.",
            severity: "Critical",
            location: loc,
          },
          ctx,
        ),
      );
    }

    // File inputs with wrong enctype
    const hasFileInput = form.fields.some((f) => f.type === "file");
    if (hasFileInput) {
      const enctype = (form.enctype ?? "application/x-www-form-urlencoded").toLowerCase();
      if (!enctype.includes("multipart/form-data")) {
        issues.push(
          makeScanIssue(
            {
              code: ISSUE_CODES.FILE_INPUT_WRONG_ENCTYPE,
              title: 'File input present but enctype is not "multipart/form-data"',
              explanation:
                "When a form contains a file input, the enctype must be " +
                '"multipart/form-data". Without it, the file\'s binary content is ' +
                "corrupted or lost during transmission.",
              evidence: `enctype="${form.enctype ?? "(not set — defaults to application/x-www-form-urlencoded)"}"`,
              recommendedFix:
                'Add enctype="multipart/form-data" to the <form> element.',
              severity: "Critical",
              location: loc,
            },
            ctx,
          ),
        );
      }
    }

    // Insecure enctype for non-file forms (rare but possible)
    if (
      form.enctype !== null &&
      !form.enctype.toLowerCase().includes("application/x-www-form-urlencoded") &&
      !form.enctype.toLowerCase().includes("multipart/form-data") &&
      !form.enctype.toLowerCase().includes("text/plain")
    ) {
      issues.push(
        makeScanIssue(
          {
            code: ISSUE_CODES.INSECURE_ENCTYPE,
            title: "Unrecognised form enctype",
            explanation:
              "The form enctype is not one of the three standard values. Unexpected " +
              "enctypes may cause data to be dropped or misinterpreted by the server.",
            evidence: `enctype="${form.enctype}"`,
            recommendedFix:
              'Set enctype to "application/x-www-form-urlencoded" for standard forms, ' +
              'or "multipart/form-data" for forms with file inputs.',
            severity: "Warning",
            location: loc,
          },
          ctx,
        ),
      );
    }

    // Missing success state
    if (!form.hasSuccessState) {
      issues.push(
        makeScanIssue(
          {
            code: ISSUE_CODES.NO_SUCCESS_STATE,
            title: "No visible success state detected",
            explanation:
              "After a successful form submission, users need feedback confirming their " +
              "action. Without a success state, users may submit repeatedly or lose trust. " +
              "Note: client-rendered success states are not visible in static HTML.",
            evidence: `No success-indicating text, class, or aria role found in form[${form.index}] HTML block.`,
            recommendedFix:
              "Show a success message or redirect to a confirmation page after 2xx response.",
            severity: "Warning",
            location: loc,
          },
          ctx,
        ),
      );
    }

    // Missing error state
    if (!form.hasErrorState) {
      issues.push(
        makeScanIssue(
          {
            code: ISSUE_CODES.NO_ERROR_STATE,
            title: "No visible error state detected",
            explanation:
              "Forms must surface error messages to users when submission fails or " +
              "validation errors occur. Without error handling, users don't know what to fix.",
            evidence: `No error-indicating text, aria-invalid, or alert class found in form[${form.index}] HTML block.`,
            recommendedFix:
              "Add inline field errors (aria-invalid + aria-describedby) and a form-level error banner.",
            severity: "Warning",
            location: loc,
          },
          ctx,
        ),
      );
    }

    // Missing loading state
    if (!form.hasLoadingState) {
      issues.push(
        makeScanIssue(
          {
            code: ISSUE_CODES.NO_LOADING_STATE,
            title: "No visible loading state detected",
            explanation:
              "Without a loading/submitting state, users may click submit multiple times, " +
              "causing duplicate submissions. Disable the submit button and show a spinner " +
              "while the request is in flight.",
            evidence: `No loading/spinner indicator found in form[${form.index}] HTML block.`,
            recommendedFix:
              "Add aria-busy and a visible loading indicator; disable the submit button during submission.",
            severity: "Warning",
            location: loc,
          },
          ctx,
        ),
      );
    }

    // Missing CAPTCHA (Improvement, not Warning — it's recommended but not always required)
    if (!form.hasCaptcha) {
      issues.push(
        makeScanIssue(
          {
            code: ISSUE_CODES.NO_CAPTCHA,
            title: "No CAPTCHA or bot protection detected",
            explanation:
              "Public-facing forms without bot protection are vulnerable to spam and " +
              "automated abuse. Consider adding Cloudflare Turnstile (recommended), " +
              "hCaptcha, or a honeypot field.",
            evidence: `No Turnstile, hCaptcha, or reCAPTCHA markup found in the page HTML.`,
            recommendedFix:
              "Add Cloudflare Turnstile to the form. Include the cf-turnstile-response field in submissions.",
            severity: "Improvement",
            location: loc,
          },
          ctx,
        ),
      );
    }

    // Per-field issues
    for (const field of form.fields) {
      if (field.type === "hidden" || field.type === "submit" || field.type === "button") {
        continue; // These don't need labels / accessibility attributes.
      }

      const fieldLoc = `form[${form.index}] ${field.name !== null ? `[name="${field.name}"]` : `[type="${field.type}"]`}`;

      // Missing label
      if (field.label === null && !field.hasAriaLabel) {
        issues.push(
          makeScanIssue(
            {
              code: ISSUE_CODES.MISSING_LABEL,
              title: "Input has no associated label",
              explanation:
                "Every form input must have a programmatically associated label so that " +
                "screen readers can announce it. Without a label, the field is inaccessible " +
                "to assistive technology users. Use <label for=…> or aria-label.",
              evidence: field.rawHtml,
              recommendedFix:
                "Add a <label for=\"fieldId\"> element, or add aria-label=\"Field name\" directly to the input.",
              severity: "Warning",
              location: fieldLoc,
            },
            ctx,
          ),
        );
      } else if (field.label === null && field.hasAriaLabel) {
        // Has aria-label but no visible label — flag as Improvement
        issues.push(
          makeScanIssue(
            {
              code: ISSUE_CODES.MISSING_ARIA_LABEL,
              title: "Input relies only on aria-label — prefer a visible label",
              explanation:
                "Using aria-label without a visible text label can make forms harder to " +
                "use for users with cognitive disabilities or those who use speech recognition. " +
                "Visible labels are preferred.",
              evidence: field.rawHtml,
              recommendedFix:
                "Add a visible <label> element in addition to or instead of aria-label.",
              severity: "Improvement",
              location: fieldLoc,
            },
            ctx,
          ),
        );
      }

      // Missing autocomplete on personal-data fields
      if (
        !field.hasAutocomplete &&
        /email|name|phone|address|postal|zip|city|country|tel/i.test(field.name ?? "")
      ) {
        issues.push(
          makeScanIssue(
            {
              code: ISSUE_CODES.MISSING_AUTOCOMPLETE,
              title: 'Personal-data field missing "autocomplete" attribute',
              explanation:
                "Adding autocomplete to fields like name, email, and phone helps users " +
                "fill forms faster and reduces errors. It is also required for WCAG 1.3.5 " +
                "Input Purpose compliance.",
              evidence: field.rawHtml,
              recommendedFix: `Add autocomplete="email" (or the appropriate token) to the input.`,
              severity: "Improvement",
              location: fieldLoc,
            },
            ctx,
          ),
        );
      }
    }
  }

  // Leaked secrets (page-level, not form-level)
  const secretFindings = detectLeakedSecrets(pageHtml);
  for (const [evidence, description] of secretFindings) {
    issues.push(
      makeScanIssue(
        {
          code: ISSUE_CODES.SECRET_IN_MARKUP,
          title: "Possible secret or API key found in page markup",
          explanation:
            `${description} Secrets must never appear in client-deliverable HTML, ` +
            "JavaScript bundles, or hidden inputs. Move secrets server-side.",
          evidence,
          recommendedFix:
            "Remove the secret from the markup. Store it server-side in an environment variable " +
            "and access it only in server code. Rotate the secret immediately if it was public.",
          severity: "Critical",
          location: "page markup / inline script",
        },
        ctx,
      ),
    );
  }

  // Sort: Critical first, then Warning, then Improvement.
  const order: Record<string, number> = { Critical: 0, Warning: 1, Improvement: 2 };
  return issues.sort((a, b) => (order[a.severity] ?? 99) - (order[b.severity] ?? 99));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Scan a user-supplied URL for form issues.
 *
 * SSRF: We call assertSafeEgressUrl before fetching and use safeFetch to
 * re-validate every redirect hop.
 *
 * @param url - User-supplied URL of the page to scan.
 * @param ctx - PromptContext for generating AI repair prompts.
 */
export async function analyzeUrl(
  url: string,
  ctx: PromptContext,
): Promise<ScanResult> {
  const scannedAt = new Date().toISOString();

  // -------------------------------------------------------------------------
  // SSRF guard — validate URL before any outbound request.
  // DNS REBINDING NOTE: hostname validation here is a first line of defence.
  // See the module-level comment for the full risk profile.
  // -------------------------------------------------------------------------
  let safeUrl: Awaited<ReturnType<typeof assertSafeEgressUrl>>;
  try {
    safeUrl = await assertSafeEgressUrl(url);
  } catch (err) {
    const reason =
      err instanceof SsrfError
        ? err.reason
        : "UNKNOWN";
    return {
      url,
      httpStatus: 0,
      formFound: false,
      forms: [],
      issues: [],
      scannedAt,
      ssrfBlocked: true,
      ssrfReason: reason,
    };
  }

  // -------------------------------------------------------------------------
  // Fetch with timeout
  // -------------------------------------------------------------------------
  let response: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      // safeFetch handles redirect-chain SSRF re-validation.
      response = await safeFetch(safeUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "SubmitPulse-Scanner/1.0 (+https://submitpulse.io/scanner)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (err instanceof SsrfError) {
      return {
        url,
        httpStatus: 0,
        formFound: false,
        forms: [],
        issues: [],
        scannedAt,
        ssrfBlocked: true,
        ssrfReason: err.reason,
      };
    }
    throw err;
  }

  const httpStatus = response.status;

  // -------------------------------------------------------------------------
  // Read body — cap at MAX_BODY_BYTES to prevent DoS via huge responses.
  // -------------------------------------------------------------------------
  let html: string;
  {
    const reader = response.body?.getReader();
    if (reader === undefined || reader === null) {
      html = await response.text();
    } else {
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let done = false;
      while (!done) {
        const result = await reader.read();
        if (result.done) {
          done = true;
          break;
        }
        totalBytes += result.value.byteLength;
        if (totalBytes > MAX_BODY_BYTES) {
          // Body too large — cancel and use what we have.
          await reader.cancel().catch(() => undefined);
          done = true;
        } else {
          chunks.push(result.value);
        }
      }
      // Merge chunks into a single Uint8Array without double-spreading.
      const totalLen = chunks.reduce((s, c) => s + c.byteLength, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      html = new TextDecoder().decode(merged);
    }
  }

  // -------------------------------------------------------------------------
  // Parse forms
  // -------------------------------------------------------------------------
  const pageBaseUrl = safeUrl.href;
  const rawBlocks = extractFormBlocks(html);
  const states = detectStates(html);
  const hasCaptchaPage = detectCaptcha(html);

  const parsedForms: FormInfo[] = rawBlocks.map((block, index) => {
    // Extract the opening <form …> tag.
    const openTagMatch = /^(<form(?:\s[^>]*)?>)/i.exec(block);
    const openTag = openTagMatch?.[1] ?? block.slice(0, 200);

    const action = extractAttr(openTag, "action");
    let absoluteAction: string | null = null;
    if (action !== null && action !== "") {
      try {
        absoluteAction = new URL(action, pageBaseUrl).href;
      } catch {
        absoluteAction = null;
      }
    } else if (action === "") {
      // Empty action means submit to the current page.
      absoluteAction = pageBaseUrl;
    }

    const method = (extractAttr(openTag, "method") ?? "GET").toUpperCase();
    const enctype = extractAttr(openTag, "enctype");
    const fields = extractFields(block);

    return {
      index,
      action,
      absoluteAction,
      method,
      enctype,
      rawHtml: block.slice(0, 4096),
      fields,
      hasSuccessState: states.hasSuccessState,
      hasErrorState: states.hasErrorState,
      hasLoadingState: states.hasLoadingState,
      hasCaptcha: hasCaptchaPage,
    };
  });

  const issues = collectIssues(pageBaseUrl, html, parsedForms, ctx);

  return {
    url,
    httpStatus,
    formFound: parsedForms.length > 0,
    forms: parsedForms,
    issues,
    scannedAt,
    ssrfBlocked: false,
  };
}
