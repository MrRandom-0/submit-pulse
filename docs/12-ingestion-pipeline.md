# 12 — Ingestion Pipeline

Source: `apps/ingest/src/`

The pipeline runs synchronously on every `POST /v1/forms/:publicFormId/submissions` request. It is a Cloudflare Workers edge service using the Hono framework.

## Pipeline stages

Each stage is a separate module in `apps/ingest/src/pipeline/`. A stage either returns a `Response` (short-circuits the pipeline) or returns data for the next stage.

### Stage 1: Request size (`request-size.ts`)

Reads the body with a size guard. The guard is applied before the form is looked up, using an absolute maximum of 25 MiB (26,214,400 bytes). If the body exceeds this, a 413 `PAYLOAD_TOO_LARGE` is returned immediately.

After the form is found (stage 2), the per-form `max_body_bytes` limit is re-enforced. The default is 1 MiB.

### Stage 2: Form lookup (`form-lookup.ts`)

Resolves the `publicFormId` URL parameter to a form row. Returns 404 `FORM_NOT_FOUND` if:
- No form exists with that public ID.
- The form's status is `paused` or `archived` (returns 404 to avoid leaking existence).
- The form's workspace is suspended.

**Production implementation**: `D1FormRepository` in `apps/ingest/src/repository/d1-form-repository.ts`. The SQL queries in this file are not yet implemented (stubs).

**Development implementation**: `DevFormRepository` in `apps/ingest/src/repository/dev-form-repository.ts`. Returns a hard-coded fixture form for any non-empty public ID.

### Stage 3: Rate limiting (`rate-limit.ts`)

Three independent limits checked in order:

| Limit | Threshold | Window |
|---|---|---|
| Per-IP global | 60 requests | 60 seconds |
| Per-IP per-form | 10 requests | 5 minutes (300 seconds) |
| Per-form ceiling | 500 requests | 60 seconds |

Returns 429 `RATE_LIMITED` when any limit is exceeded.

**Fail-open behaviour**: If the rate limiter throws (e.g. Redis connection failure), the request is allowed through with a logged error. The code comment notes this should be reconsidered based on risk tolerance for production.

**Current state**: `InMemoryRateLimiter` is always used because no Upstash credentials exist. The in-memory store resets on every worker restart and does not share state across instances.

### Stage 4: Origin evaluation (`origin-evaluation.ts`)

If `form.enforce_origin` is true, checks the request's `Origin` header against `form.form_domains`. Returns 403 `ORIGIN_REJECTED` if the origin is not in the allowlist.

`form.allow_localhost` permits `localhost` and `127.0.0.1` origins when true (default).

The allowed origin string is also used to set `Access-Control-Allow-Origin` in all subsequent responses.

Stage 4 runs before stage 3 in the code because the CORS origin is needed for the 429 response headers.

### Stage 5: Schema validation (`schema-validation.ts`)

Parses the body according to `content-type`:
- `application/json` → JSON parse.
- `multipart/form-data` → multipart parse (extracts files separately).

Validates the parsed payload against `form.fields`. Constructs `data` (validated fields) and `unexpectedData` (fields present but absent from schema). Returns 400 `VALIDATION_ERROR` with per-field error detail when required fields are missing or type constraints fail.

The honeypot field (if configured) is stripped from `payloadForValidation` before schema validation runs. It is evaluated in the spam stage instead.

### Stage 6: CAPTCHA (`captcha.ts`)

If `form.captcha_enabled` is true, extracts `cf-turnstile-response` from the payload and calls the captcha verifier. Returns 400 `CAPTCHA_FAILED` if verification fails.

The `cf-turnstile-response` field is stripped from `cleanPayload` after successful verification (it is not stored in the submission data).

**Current state**: `DevBypassCaptchaVerifier` accepts all tokens. `TurnstileVerifier` is used only when `ENVIRONMENT === "production"` and `SP_TURNSTILE_SECRET_KEY` is set.

### Stage 7: Spam rules (`spam-rules.ts`)

Synchronous inline spam scoring. Computes a score from 0 to 1.

Signals evaluated:
- Honeypot field: if `form.honeypot_field_name` is set and the field is non-empty → verdict `blocked`, score 1. Returns 400 immediately.
- IP blocklist: checks `clientIp` against loaded spam rules.
- Keyword blocklist: checks payload field values.
- Allowlist: negative-weight rules that reduce the score.

The verdict `blocked` causes an immediate 400 `SUBMISSION_BLOCKED` response. Other verdicts (`clean`, `suspicious`, `spam`) do not block synchronously; the submission is stored and the queue worker handles further AI analysis.

**Note from code**: Custom spam rules are loaded as an empty array (`[] as SpamRule[]`) with a comment: "TODO: load from DB in D1FormRepository when implemented."

### Stage 8: File validation (`file-validation.ts`)

Only runs when files were parsed in stage 5. Validates each file against `form.fields` file constraints:
- Extension allowlist.
- MIME type allowlist.
- Magic-byte verification (must agree with declared type within the same family).
- Double-extension detection (e.g. `malware.pdf.exe`).
- Blocked extension list (executables, scripts, SVG).
- Per-file size limit.
- Total file count limit.

Returns a `ValidatedFile` with a server-generated storage key (never derived from the client filename). The storage key format is `uploads/<8-char-hash>/<uuid>.<ext>`.

**Note**: File storage does not actually occur. The storage key is generated but no upload to Cloudflare R2 or similar happens.

### Stage 9: Persistence (`persistence.ts`)

Writes the submission row using `D1FormRepository.createSubmission()` (not yet implemented in production; dev repository returns a fixture).

Idempotency is checked at this stage: if an `Idempotency-Key` header was provided and a submission with that key already exists for the form, the existing `publicId` is returned and `isIdempotentRepeat = true` is set to suppress re-enqueuing.

### Stage 10: Enqueue (`enqueue.ts`)

Publishes a job to `SUBMISSION_QUEUE` (Cloudflare Queue producer binding). The job carries `{submissionId, formId, workspaceId, requestId, acceptedAt}`.

Enqueueing is fire-and-forget: if it fails, the submission is already persisted and the response is still 202. The queue binding is a placeholder (not provisioned).

## Response

On success: HTTP 202.

```json
{
  "ok": true,
  "requestId": "<uuid>",
  "submissionId": "<sub_xxx>"
}
```

Response headers always include:
- `Content-Type: application/json`
- `x-submitpulse-request-id: <uuid>`
- `X-Content-Type-Options: nosniff`
- `Cache-Control: no-store`
- CORS headers if origin was allowed.

## What is not on the hot path

The following never run during ingestion:
- Email notification sending.
- Webhook delivery.
- AI-powered spam analysis.
- File antivirus scanning.
- Drift detection.
- Analytics counter updates.

All of these are handled by the queue consumer worker (`apps/worker`).

## Health check endpoint

`GET /health` returns `{ ok: true, service: "submitpulse", ts: "<iso>" }` without authentication. Used by Cloudflare Workers health checks and load balancers.
