/**
 * SCANNER ISSUE MODEL
 * ===================
 * Typed issue model for the Website Form Scanner.
 *
 * Every issue MUST carry real evidence — the actual markup or value observed.
 * Emitting an issue without evidence is a bug; callers must provide the snippet.
 */

import {
  generateScannerFixPrompt,
  type PromptContext,
  type ScannerIssue as ConfigScannerIssue,
} from "@submitpulse/config";

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export type Severity = "Critical" | "Warning" | "Improvement";

// ---------------------------------------------------------------------------
// Issue type
// ---------------------------------------------------------------------------

/**
 * A single finding from the form scanner.
 *
 * `evidence` is mandatory — it is the actual markup, attribute value, or
 * observed payload that confirms the issue exists. Never emit a finding
 * without evidence: evidence = the specific thing we observed.
 */
export interface ScanIssue {
  /** Short machine-readable code, e.g. "method-get". */
  readonly code: string;
  /** Human-readable title. */
  readonly title: string;
  /** Detailed explanation of why this matters. */
  readonly explanation: string;
  /**
   * The actual markup or value that was observed — NOT a description of the
   * problem, but the literal evidence. E.g. `<form method="get">` or
   * `action="http://..."`.
   */
  readonly evidence: string;
  /** How to fix it. */
  readonly recommendedFix: string;
  /** Severity level. */
  readonly severity: Severity;
  /**
   * AI repair prompt, generated via generateScannerFixPrompt.
   * Paste into your AI tool to fix the issue automatically.
   */
  readonly aiRepairPrompt: string;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Build a `ScanIssue` from raw parts, automatically generating the AI repair
 * prompt from the given PromptContext.
 *
 * `evidence` must be the literal markup snippet or value that was observed.
 * If you have no evidence, you do NOT have an issue — do not call this.
 */
export function makeScanIssue(
  params: {
    readonly code: string;
    readonly title: string;
    readonly explanation: string;
    /** The literal observed markup / value. Required — no issue without evidence. */
    readonly evidence: string;
    readonly recommendedFix: string;
    readonly severity: Severity;
    /** Optional location hint, e.g. "form[0] > input[name=email]". */
    readonly location?: string | undefined;
  },
  ctx: PromptContext,
): ScanIssue {
  const configIssue: ConfigScannerIssue = {
    code: params.code,
    description: params.explanation,
    ...(params.location !== undefined
      ? { location: params.location }
      : undefined),
    suggestedFix: params.recommendedFix,
  };

  const aiRepairPrompt = generateScannerFixPrompt({ ...ctx, issue: configIssue });

  return {
    code: params.code,
    title: params.title,
    explanation: params.explanation,
    evidence: params.evidence,
    recommendedFix: params.recommendedFix,
    severity: params.severity,
    aiRepairPrompt,
  };
}

// ---------------------------------------------------------------------------
// Well-known issue codes
// ---------------------------------------------------------------------------

/** All codes recognised by the scanner. Add new codes here to stay consistent. */
export const ISSUE_CODES = {
  // Critical
  METHOD_GET: "method-get",
  NO_HTTPS_ACTION: "no-https-action",
  SECRET_IN_MARKUP: "secret-in-markup",
  INSECURE_ENCTYPE: "insecure-enctype",
  NO_FORM_FOUND: "no-form-found",
  // Warning
  MISSING_LABEL: "missing-label",
  MISSING_REQUIRED_ATTR: "missing-required-attr",
  NO_SUCCESS_STATE: "no-success-state",
  NO_ERROR_STATE: "no-error-state",
  NO_LOADING_STATE: "no-loading-state",
  NO_CAPTCHA: "no-captcha",
  ENDPOINT_MISMATCH: "endpoint-mismatch",
  FILE_INPUT_WRONG_ENCTYPE: "file-input-wrong-enctype",
  // Improvement
  MISSING_ARIA_LABEL: "missing-aria-label",
  MISSING_ARIA_REQUIRED: "missing-aria-required",
  MISSING_AUTOCOMPLETE: "missing-autocomplete",
  MISSING_PLACEHOLDER: "missing-placeholder",
} as const;
