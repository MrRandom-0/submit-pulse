/**
 * Structured response helpers.
 *
 * All responses share a consistent shape:
 *   { ok, requestId, submissionId?, error?: { code, message, fields? } }
 *
 * Internal errors, stack traces, and database details are NEVER leaked.
 * All error paths map to a safe code and a generic message.
 */

import { brand } from "@submitpulse/config/brand";

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly fields?: readonly FieldError[];
}

export interface FieldError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

interface SuccessBody {
  readonly ok: true;
  readonly requestId: string;
  readonly submissionId: string;
}

interface ErrorBody {
  readonly ok: false;
  readonly requestId: string;
  readonly error: ApiError;
}

export type ResponseBody = SuccessBody | ErrorBody;

function baseHeaders(
  requestId: string,
  corsOrigin: string | null,
): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [brand.wire.requestIdHeader]: requestId,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };

  if (corsOrigin !== null) {
    headers["Access-Control-Allow-Origin"] = corsOrigin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Expose-Headers"] = brand.wire.requestIdHeader;
    headers["Vary"] = "Origin";
  }

  return headers;
}

export function successResponse(
  requestId: string,
  submissionId: string,
  corsOrigin: string | null,
): Response {
  const body: SuccessBody = { ok: true, requestId, submissionId };
  return new Response(JSON.stringify(body), {
    status: 202,
    headers: baseHeaders(requestId, corsOrigin),
  });
}

export function errorResponse(
  status: number,
  requestId: string,
  error: ApiError,
  corsOrigin: string | null,
): Response {
  const body: ErrorBody = { ok: false, requestId, error };
  return new Response(JSON.stringify(body), {
    status,
    headers: baseHeaders(requestId, corsOrigin),
  });
}

// ---------------------------------------------------------------------------
// Well-known error factories
// ---------------------------------------------------------------------------

export const Errors = {
  payloadTooLarge: (requestId: string, corsOrigin: string | null) =>
    errorResponse(413, requestId, { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the size limit for this form" }, corsOrigin),

  formNotFound: (requestId: string, corsOrigin: string | null) =>
    errorResponse(404, requestId, { code: "FORM_NOT_FOUND", message: "Form not found" }, corsOrigin),

  formPaused: (requestId: string, corsOrigin: string | null) =>
    errorResponse(404, requestId, { code: "FORM_NOT_FOUND", message: "Form not found" }, corsOrigin),

  rateLimited: (requestId: string, corsOrigin: string | null) =>
    errorResponse(429, requestId, { code: "RATE_LIMITED", message: "Too many submissions. Please try again later." }, corsOrigin),

  originRejected: (requestId: string, corsOrigin: string | null) =>
    errorResponse(403, requestId, { code: "ORIGIN_REJECTED", message: "Submissions from this origin are not allowed" }, corsOrigin),

  validationFailed: (
    requestId: string,
    fields: readonly FieldError[],
    corsOrigin: string | null,
  ) =>
    errorResponse(400, requestId, { code: "VALIDATION_ERROR", message: "One or more fields are invalid", fields }, corsOrigin),

  captchaFailed: (requestId: string, corsOrigin: string | null) =>
    errorResponse(400, requestId, { code: "CAPTCHA_FAILED", message: "Bot protection check failed. Please try again." }, corsOrigin),

  spamBlocked: (requestId: string, corsOrigin: string | null) =>
    errorResponse(400, requestId, { code: "SUBMISSION_BLOCKED", message: "This submission was blocked" }, corsOrigin),

  serviceUnavailable: (requestId: string, corsOrigin: string | null) =>
    errorResponse(503, requestId, { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable" }, corsOrigin),

  badRequest: (requestId: string, message: string, corsOrigin: string | null) =>
    errorResponse(400, requestId, { code: "BAD_REQUEST", message }, corsOrigin),
} as const;
