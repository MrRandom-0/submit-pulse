/**
 * Typed API reference data — feeds the interactive docs page.
 * All strings are exact values from the running code.
 */

import { brand } from "@submitpulse/config/brand";

export const BASE_URL = brand.domains.api;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParamDef {
  readonly name: string;
  readonly location: "path" | "header" | "query";
  readonly required: boolean;
  readonly type: string;
  readonly description: string;
  readonly example?: string;
}

export interface ExampleTab {
  readonly label: string;
  readonly language: string;
  readonly code: string;
}

export interface ResponseDef {
  readonly status: number;
  readonly description: string;
  readonly body: string; // JSON string for display
}

export interface EndpointDef {
  readonly id: string;
  readonly method: "GET" | "POST" | "OPTIONS" | "PATCH" | "DELETE";
  readonly path: string;
  readonly summary: string;
  readonly description: string;
  readonly implemented: boolean;
  readonly tag: string;
  readonly params?: readonly ParamDef[];
  readonly requestTabs?: readonly ExampleTab[];
  readonly responses: readonly ResponseDef[];
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const ENDPOINTS: readonly EndpointDef[] = [
  // ---- Health -------------------------------------------------------------
  {
    id: "get-health",
    method: "GET",
    path: "/health",
    summary: "Service health check",
    description:
      "Returns the service name and current ISO timestamp. No authentication required. Not rate-limited.",
    implemented: true,
    tag: "Health",
    responses: [
      {
        status: 200,
        description: "Service is healthy.",
        body: JSON.stringify(
          { ok: true, service: "submitpulse", ts: "2025-06-01T12:00:00.000Z" },
          null,
          2,
        ),
      },
    ],
  },

  // ---- CORS preflight -----------------------------------------------------
  {
    id: "options-submission",
    method: "OPTIONS",
    path: "/v1/forms/{publicFormId}/submissions",
    summary: "CORS preflight",
    description:
      "Returns 204 with permissive CORS headers. Does not enforce the form's origin allowlist — the actual POST does.",
    implemented: true,
    tag: "Ingestion",
    params: [
      {
        name: "publicFormId",
        location: "path",
        required: true,
        type: "string",
        description: "The form's public identifier (fm_…).",
        example: "fm_a1b2c3d4e5f6a7b8",
      },
    ],
    responses: [
      {
        status: 204,
        description: "Preflight accepted.",
        body: "",
      },
    ],
  },

  // ---- Submit submission --------------------------------------------------
  {
    id: "post-submission",
    method: "POST",
    path: "/v1/forms/{publicFormId}/submissions",
    summary: "Submit a form",
    description: `Accepts a form submission and returns HTTP 202 when the submission has been persisted and queued for async processing.

**Content types accepted:**
- \`application/json\` — preferred
- \`application/x-www-form-urlencoded\` — plain HTML forms
- \`multipart/form-data\` — required for file uploads

**CAPTCHA token** (when enabled): include as \`cf-turnstile-response\` body field or \`X-Captcha-Response\` header.

HTTP 202 means the submission is durable — email and webhooks fire asynchronously after this response.`,
    implemented: true,
    tag: "Ingestion",
    params: [
      {
        name: "publicFormId",
        location: "path",
        required: true,
        type: "string",
        description: "The form's public identifier (fm_…).",
        example: "fm_a1b2c3d4e5f6a7b8",
      },
      {
        name: "Idempotency-Key",
        location: "header",
        required: false,
        type: "string",
        description:
          "Client-generated unique string. Repeat requests with the same key return the original submissionId without creating a duplicate. Keys are stored for 24 hours.",
        example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      },
      {
        name: "X-Captcha-Response",
        location: "header",
        required: false,
        type: "string",
        description:
          "Cloudflare Turnstile token. Alternative to including it as the cf-turnstile-response body field.",
      },
      {
        name: `${brand.wire.syntheticHeader}`,
        location: "header",
        required: false,
        type: "string (\"1\" | \"true\")",
        description:
          "Mark as a synthetic health-check submission. Excluded from real submission counts and billing.",
      },
    ],
    requestTabs: [
      {
        label: "JSON",
        language: "json",
        code: JSON.stringify(
          {
            name: "Alice Johnson",
            email: "alice@example.com",
            message: "Hello, I have a question.",
          },
          null,
          2,
        ),
      },
      {
        label: "URL-encoded",
        language: "http",
        code: "name=Alice+Johnson&email=alice%40example.com&message=Hello",
      },
      {
        label: "cURL",
        language: "bash",
        code: `curl -X POST "${BASE_URL}/v1/forms/fm_your_form_id/submissions" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"name":"Alice Johnson","email":"alice@example.com","message":"Hello"}'`,
      },
      {
        label: "JavaScript",
        language: "javascript",
        code: `const res = await fetch(
  "${BASE_URL}/v1/forms/fm_your_form_id/submissions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      name: "Alice Johnson",
      email: "alice@example.com",
      message: "Hello",
    }),
  }
);

if (res.ok) {
  const { submissionId } = await res.json();
  console.log("Accepted:", submissionId);
} else {
  const { error } = await res.json();
  console.error(error.code, error.message);
}`,
      },
    ],
    responses: [
      {
        status: 202,
        description:
          "Submission accepted. Persisted and queued for async processing.",
        body: JSON.stringify(
          {
            ok: true,
            requestId: "550e8400-e29b-41d4-a716-446655440000",
            submissionId: "sub_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
          },
          null,
          2,
        ),
      },
      {
        status: 400,
        description:
          "Bad request. Code is one of: VALIDATION_ERROR (with fields array), CAPTCHA_FAILED, SUBMISSION_BLOCKED, BAD_REQUEST.",
        body: JSON.stringify(
          {
            ok: false,
            requestId: "550e8400-e29b-41d4-a716-446655440000",
            error: {
              code: "VALIDATION_ERROR",
              message: "One or more fields are invalid",
              fields: [
                {
                  field: "email",
                  code: "INVALID_FORMAT",
                  message: "Must be a valid email address",
                },
              ],
            },
          },
          null,
          2,
        ),
      },
      {
        status: 403,
        description:
          "Request origin is not in the form's allowed-origins list and enforce_origin is enabled.",
        body: JSON.stringify(
          {
            ok: false,
            requestId: "550e8400-e29b-41d4-a716-446655440000",
            error: {
              code: "ORIGIN_REJECTED",
              message: "Submissions from this origin are not allowed",
            },
          },
          null,
          2,
        ),
      },
      {
        status: 404,
        description:
          "Form not found, or form is paused. Both return 404 to avoid leaking existence.",
        body: JSON.stringify(
          {
            ok: false,
            requestId: "550e8400-e29b-41d4-a716-446655440000",
            error: { code: "FORM_NOT_FOUND", message: "Form not found" },
          },
          null,
          2,
        ),
      },
      {
        status: 413,
        description:
          "Body exceeds per-form limit or the absolute ceiling of 26 MiB.",
        body: JSON.stringify(
          {
            ok: false,
            requestId: "550e8400-e29b-41d4-a716-446655440000",
            error: {
              code: "PAYLOAD_TOO_LARGE",
              message: "Request body exceeds the size limit for this form",
            },
          },
          null,
          2,
        ),
      },
      {
        status: 429,
        description:
          "Rate limited. Three limits: per-IP global (60/60s), per-IP/form (10/300s), per-form (500/60s).",
        body: JSON.stringify(
          {
            ok: false,
            requestId: "550e8400-e29b-41d4-a716-446655440000",
            error: {
              code: "RATE_LIMITED",
              message: "Too many submissions. Please try again later.",
            },
          },
          null,
          2,
        ),
      },
      {
        status: 503,
        description:
          "Transient internal error — DB write failure or CAPTCHA provider down. Retry with backoff.",
        body: JSON.stringify(
          {
            ok: false,
            requestId: "550e8400-e29b-41d4-a716-446655440000",
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "Service temporarily unavailable",
            },
          },
          null,
          2,
        ),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Rate limit table
// ---------------------------------------------------------------------------

export interface RateLimitRow {
  readonly label: string;
  readonly limit: number;
  readonly window: string;
}

export const RATE_LIMITS: readonly RateLimitRow[] = [
  {
    label: "Per-IP global (all forms)",
    limit: 60,
    window: "60 seconds",
  },
  {
    label: "Per-IP per-form",
    limit: 10,
    window: "300 seconds (5 min)",
  },
  {
    label: "Per-form ceiling",
    limit: 500,
    window: "60 seconds",
  },
];

// ---------------------------------------------------------------------------
// Error code table
// ---------------------------------------------------------------------------

export interface ErrorCodeRow {
  readonly status: number;
  readonly code: string;
  readonly cause: string;
  readonly hasFields: boolean;
}

export const ERROR_CODES: readonly ErrorCodeRow[] = [
  {
    status: 400,
    code: "VALIDATION_ERROR",
    cause:
      "Required field missing, type wrong, or constraint violated. error.fields array is present.",
    hasFields: true,
  },
  {
    status: 400,
    code: "CAPTCHA_FAILED",
    cause: "Turnstile token absent or server-side verification failed.",
    hasFields: false,
  },
  {
    status: 400,
    code: "SUBMISSION_BLOCKED",
    cause: "Honeypot field populated or an explicit block rule matched.",
    hasFields: false,
  },
  {
    status: 400,
    code: "BAD_REQUEST",
    cause:
      "Malformed JSON, unsupported Content-Type, or invalid multipart body.",
    hasFields: false,
  },
  {
    status: 403,
    code: "ORIGIN_REJECTED",
    cause:
      "Request origin not in the form's allowed list (when enforce_origin is true).",
    hasFields: false,
  },
  {
    status: 404,
    code: "FORM_NOT_FOUND",
    cause:
      "No active form with that ID. Also returned for paused forms (existence not leaked).",
    hasFields: false,
  },
  {
    status: 413,
    code: "PAYLOAD_TOO_LARGE",
    cause: "Body exceeds per-form limit or 26 MiB absolute ceiling.",
    hasFields: false,
  },
  {
    status: 429,
    code: "RATE_LIMITED",
    cause:
      "Too many requests. See rate limits table for thresholds.",
    hasFields: false,
  },
  {
    status: 503,
    code: "SERVICE_UNAVAILABLE",
    cause: "DB write failure or CAPTCHA provider down. Retry with backoff.",
    hasFields: false,
  },
];

// ---------------------------------------------------------------------------
// Wire constants
// ---------------------------------------------------------------------------

export interface WireHeaderRow {
  readonly header: string;
  readonly direction: string;
  readonly notes: string;
}

export const WIRE_HEADERS: readonly WireHeaderRow[] = [
  {
    header: brand.wire.requestIdHeader,
    direction: "Response",
    notes: "UUID echoing requestId. Use for log correlation.",
  },
  {
    header: brand.wire.signatureHeader,
    direction: "Webhook outbound",
    notes: 'sha256=<hex> — HMAC-SHA256 of the payload.',
  },
  {
    header: brand.wire.timestampHeader,
    direction: "Webhook outbound",
    notes: "Unix seconds (string). Used for replay-window verification.",
  },
  {
    header: brand.wire.deliveryIdHeader,
    direction: "Webhook outbound",
    notes: "UUID per delivery attempt. Retries get a new ID.",
  },
  {
    header: brand.wire.syntheticHeader,
    direction: "Request",
    notes:
      'Set to "1" or "true" to mark as a health-check submission. Excluded from billing.',
  },
  {
    header: "Idempotency-Key",
    direction: "Request",
    notes: "Client-generated dedup key. Prevents duplicate submissions on retry.",
  },
  {
    header: "X-Captcha-Response",
    direction: "Request",
    notes:
      "Turnstile token — alternative to the cf-turnstile-response body field.",
  },
];
