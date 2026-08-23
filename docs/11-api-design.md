# 11 — API Design

## Implementation status summary

| Surface | Status |
|---------|--------|
| `POST /v1/forms/:publicFormId/submissions` | **Implemented** — Cloudflare Workers + Hono |
| `OPTIONS /v1/forms/:publicFormId/submissions` | **Implemented** — CORS preflight |
| `GET /health` | **Implemented** |
| Management REST API (forms, submissions, webhooks, API keys) | **Not implemented** — dashboard uses Next.js Server Actions |
| API key validation middleware | **Not implemented** — `api_keys` table exists; no handler reads it |

The ingestion service (`apps/ingest`) is the only running HTTP API. All other
management operations happen through the `apps/web` Next.js app via Server
Actions and Route Handlers — there is no public REST surface for those
operations.

---

## Ingestion API

### Base URL

```
https://api.submitpulse.com
```

The ingestion service runs on Cloudflare Workers (globally distributed edge)
via the Hono framework. It is a deliberately separate origin from the dashboard
(`app.submitpulse.com`) so that CORS headers on the ingestion endpoint never
expose management session cookies.

### Endpoints

| Method | Path | Auth | Status |
|--------|------|------|--------|
| `GET` | `/health` | None | Implemented |
| `OPTIONS` | `/v1/forms/:publicFormId/submissions` | None | Implemented |
| `POST` | `/v1/forms/:publicFormId/submissions` | None | Implemented |

### Pipeline architecture

Every submission passes through ten sequential stages. Each stage returns a
`Response` on failure, short-circuiting the pipeline, or passes context to the
next stage on success.

```
Request
  │
  ▼  Stage 1  request-size      — absolute 26 MiB ceiling before buffering
  ▼  Stage 2  form-lookup       — resolve publicFormId → form row
  ▼  Stage 3  origin-eval       — enforce form_domains allowlist
  ▼  Stage 4  rate-limit        — per-IP global, per-IP/form, per-form ceiling
  ▼  Stage 5  schema-validation — parse body; Zod field validation
  ▼  Stage 6  captcha           — Turnstile server-side verify (if enabled)
  ▼  Stage 7  spam-rules        — honeypot + inline signals
  ▼  Stage 8  file-validation   — magic-byte + MIME/extension allowlist
  ▼  Stage 9  persistence       — D1 write with idempotency KV dedup
  ▼  Stage 10 enqueue           — Cloudflare Queue (async: email, webhooks, AI, AV)
  │
  ▼  202 Accepted
```

Stages performed **asynchronously** by the queue consumer (never inline):
- Email notifications and autoresponders
- Webhook delivery
- AI-powered spam analysis
- File antivirus scanning
- Drift detection
- Analytics counter updates

### Wire constants

All header names are derived from `packages/config/src/brand.ts`. They are
reproduced here for clarity.

| Header | Direction | Value / format |
|--------|-----------|----------------|
| `x-submitpulse-request-id` | Response | UUID for log correlation |
| `x-submitpulse-signature` | Webhook outbound | `sha256=<hex>` |
| `x-submitpulse-timestamp` | Webhook outbound | Unix seconds (string) |
| `x-submitpulse-delivery-id` | Webhook outbound | UUID per delivery attempt |
| `x-submitpulse-synthetic` | Request | `1` or `true` marks health-check submissions |
| `Idempotency-Key` | Request | Client-generated dedup key |
| `X-Captcha-Response` | Request | Turnstile token (alternative to body field) |

### Public form ID

Form identifiers use the prefix `fm_` (from `brand.identifiers.form`).
The full identifier is produced by `formEndpoint(publicFormId)`:

```
https://api.submitpulse.com/v1/forms/<publicFormId>/submissions
```

The form ID is **public by design**. It is embedded in client-side code,
HTML source, and integration prompts. Access control is enforced through domain
allowlists, rate limits, and CAPTCHA — not through ID secrecy.

### Content types accepted

| Content-Type | Parsed as |
|---|---|
| `application/json` | JSON object — nested objects are not supported, top-level only |
| `application/x-www-form-urlencoded` | URL-decoded key/value pairs; repeated keys become arrays |
| `multipart/form-data` | Text fields + `File` objects; files passed to stage 8 |

Any other `Content-Type` returns `400 BAD_REQUEST`.

### Error shape

All errors use this envelope:

```json
{
  "ok": false,
  "requestId": "<uuid>",
  "error": {
    "code": "<SCREAMING_SNAKE>",
    "message": "<human-readable>",
    "fields": [
      { "field": "<name>", "code": "<code>", "message": "<msg>" }
    ]
  }
}
```

`fields` is present **only** for `VALIDATION_ERROR`. Internal errors, stack
traces, and database details are never included. All error factories are in
`apps/ingest/src/response.ts`.

### Error code table

| HTTP status | `error.code` | Source stage |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Schema validation (stage 5) |
| 400 | `CAPTCHA_FAILED` | CAPTCHA (stage 6) |
| 400 | `SUBMISSION_BLOCKED` | Spam rules — honeypot (stage 7) |
| 400 | `BAD_REQUEST` | Malformed request, unsupported Content-Type |
| 403 | `ORIGIN_REJECTED` | Origin evaluation (stage 3) |
| 404 | `FORM_NOT_FOUND` | Form lookup (stage 2), also returned for paused forms |
| 413 | `PAYLOAD_TOO_LARGE` | Request size (stage 1) |
| 429 | `RATE_LIMITED` | Rate limiting (stage 4) |
| 503 | `SERVICE_UNAVAILABLE` | DB write failure, captcha provider down |

### Rate limits

Three independent limits are enforced in priority order. All return `429
RATE_LIMITED` — the response does not specify which limit fired.

| Limit | Threshold | Window |
|-------|-----------|--------|
| Per-IP global (all forms) | 60 requests | 60 seconds |
| Per-IP per-form | 10 requests | 300 seconds (5 minutes) |
| Per-form ceiling | 500 requests | 60 seconds |

The rate limiter uses `InMemoryRateLimiter` in development. In production it is
intended to use Upstash Redis (`SP_UPSTASH_REDIS_REST_URL` / `SP_UPSTASH_REDIS_REST_TOKEN`),
but this swap is **not yet implemented** — the comment in `apps/ingest/src/index.ts`
marks it as `INCOMPLETE`.

### Idempotency

The `Idempotency-Key` header (lowercase) is accepted on `POST`. When a key
matches a prior accepted submission for the same form:

1. Cloudflare KV is checked first (fast path, O(1) edge lookup).
2. D1 is checked as a fallback (slow path, catches keys not yet in KV).
3. The original `submissionId` and `requestId` are returned; no new row is created.
4. Keys are cached in KV for 24 hours.

Generate keys with `crypto.randomUUID()`. Do not reuse a key for a
deliberately different submission.

### CORS

- `OPTIONS` returns a permissive preflight (origin reflected, credentials
  allowed) without checking the form's domain allowlist.
- `POST` reflects the origin only if it passes the form's `form_domains`
  allowlist when `enforce_origin = true`.
- `Access-Control-Expose-Headers` includes `x-submitpulse-request-id` so
  JavaScript can read the correlation ID.
- `Vary: Origin` is always present.

### Body size limits

- **Absolute ceiling**: 26 MiB (26,214,400 bytes) — matches the DB CHECK
  constraint maximum for `form.max_body_bytes`.
- **Per-form limit**: Each form has its own `maxBodyBytes` field. When
  `Content-Length` is present and larger than the per-form limit, the
  request is rejected before buffering.
- Default per-form limit: 1 MiB.

---

## Management API (not yet implemented)

No management REST API handler exists. The `api_keys` table is fully designed
(see `packages/database/src/schema/platform.ts`) and the intended wire
convention is `Authorization: Bearer <key>`, but no middleware validates it.

The `installation_tokens` table is designed for short-lived agent-scoped
credentials during form setup. Permitted operations for installation tokens:
- Read form configuration and active schema version
- Generate integration code snippets
- Run a single test submission

Forbidden: reading submission data, billing details, workspace membership,
minting new credentials.

---

## SDK packages

| Package | Purpose |
|---------|---------|
| `@submitpulse/browser` | Typed browser client for form submission |
| `@submitpulse/react` | React hooks wrapping the browser client |

These are browser-side submission clients only. There is no management SDK.
Code generation for integration snippets is in `packages/config/src/snippets.ts`
via `generateSnippet()`.

---

## User agent (outbound)

Outbound requests (webhooks, Pulse Monitor health tests) use:

```
SubmitPulse/1.0 (+https://submitpulse.com/bot)
```

Defined in `brand.wire.userAgent`.
