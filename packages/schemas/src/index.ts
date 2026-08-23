/**
 * @submitpulse/schemas — shared wire contracts.
 *
 * This package was declared in the workspace but shipped with an empty `src`,
 * leaving its manifest `main` dangling. Rather than delete the package, it now
 * holds the wire-level contracts shared between the ingestion service, the
 * dashboard and the SDKs, so those three cannot drift apart.
 *
 * Runtime VALIDATION lives in @submitpulse/validation. This package is types
 * only, so it stays dependency-free and safe to import from the browser SDK.
 */

/** Canonical field types a form may declare. Mirrors `fieldTypeEnum`. */
export type FieldType =
  | "text" | "email" | "phone" | "number" | "url" | "date"
  | "textarea" | "select" | "multiselect" | "checkbox" | "hidden" | "file";

export interface FieldConstraints {
  readonly min?: number;
  readonly max?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly allowedValues?: readonly string[];
  readonly maxFileCount?: number;
  readonly maxFileSizeBytes?: number;
  readonly allowedMimeTypes?: readonly string[];
}

export interface FieldSpec {
  readonly name: string;
  readonly type: FieldType;
  readonly required: boolean;
  readonly label?: string;
  readonly constraints?: FieldConstraints;
}

/** Field-level error returned by the ingestion endpoint. */
export interface FieldError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

/** The single response envelope every ingestion response conforms to. */
export interface SubmissionResponse {
  readonly ok: boolean;
  readonly requestId: string;
  readonly submissionId?: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly fields?: readonly FieldError[];
  };
}

/** Error codes the ingestion service may return. Keep in sync with apps/ingest. */
export const ERROR_CODES = [
  "invalid_request", "form_not_found", "form_paused", "origin_rejected",
  "validation_failed", "captcha_failed", "spam_rejected", "payload_too_large",
  "rate_limited", "file_rejected", "dependency_unavailable", "internal_error",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
