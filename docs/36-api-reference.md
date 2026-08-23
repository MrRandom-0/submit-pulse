# 36 — API Reference

> **Source files:** `apps/ingest/src/index.ts`, `apps/ingest/src/response.ts`,
> `apps/ingest/src/pipeline/`, `packages/config/src/brand.ts`
>
> The OpenAPI 3.1 specification lives at `docs/openapi.yaml`.

---

## Base URL

```
https://api.submitpulse.com
```

The ingestion service runs on Cloudflare Workers (globally distributed).
There is **no management REST API** — all management (forms, submissions,
webhooks, API keys) is handled through the `apps/web` dashboard via Next.js
Server Actions. Management API paths are documented in the OpenAPI spec as
design stubs marked `not_implemented`.

---

## Authentication

### Ingestion endpoint

The `POST /v1/forms/:publicFormId/submissions` endpoint requires **no
authentication**. The form ID is a public, unguessable identifier — not a
secret. Never add API keys to client-side form code.

Access control is enforced by:
- Domain allowlist (per-form `form_domains`)
- Rate limits (per-IP and per-form)
- CAPTCHA (Cloudflare Turnstile, when enabled)

### Management API (not yet implemented)

When implemented, management endpoints will use:

```http
Authorization: Bearer submitpulse_live_<random>
```

or for test mode:

```http
Authorization: Bearer submitpulse_test_<random>
```

Keys are issued in the dashboard and displayed exactly once. The server stores
only the SHA-256 hash; lost keys cannot be recovered. No handler currently
validates this header.

### Installation tokens (not yet implemented)

Short-lived tokens for AI coding agents during form setup:

```
submitpulse_setup_<random>
```

Permitted: read form config, read active schema version, generate snippets,
run one test submission.
Forbidden: read submission data, access billing, mint new credentials.

---

## Endpoints

### `GET /health`

Service health check. No authentication required. Not rate-limited.

**Response: 200**

```json
{
  "ok": true,
  "service": "submitpulse",
  "ts": "2025-06-01T12:00:00.000Z"
}
```

---

### `OPTIONS /v1/forms/:publicFormId/submissions`

CORS preflight. Returns 204. Does not check the form's origin allowlist —
the actual `POST` enforces that.

**Response headers:**

| Header | Value |
|--------|-------|
| `Access-Control-Allow-Methods` | `POST, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type, Idempotency-Key, X-Captcha-Response, x-submitpulse-request-id` |
| `Access-Control-Max-Age` | `86400` |
| `Vary` | `Origin` |
| `Access-Control-Allow-Origin` | Reflected origin (when `Origin` header is present) |
| `Access-Control-Allow-Credentials` | `true` |

---

### `POST /v1/forms/:publicFormId/submissions`

Submit a form. The primary endpoint.

#### Path parameters

| Parameter | Format | Notes |
|-----------|--------|-------|
| `publicFormId` | `fm_<random>` | The form's public identifier. Found in the dashboard. |

#### Request headers

| Header | Required | Notes |
|--------|----------|-------|
| `Content-Type` | Yes | `application/json`, `application/x-www-form-urlencoded`, or `multipart/form-data` |
| `Accept` | Recommended | `application/json` |
| `Idempotency-Key` | No | Client-generated dedup key. Max 256 chars. |
| `X-Captcha-Response` | Conditional | Turnstile token, when CAPTCHA is enabled. Can also be a body field. |
| `x-submitpulse-synthetic` | No | Set to `1` or `true` to mark as a health-check submission. |

#### Request body

**`application/json`** (preferred for JavaScript clients)

```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "message": "Hello, I have a question.",
  "cf-turnstile-response": "<token-from-widget>"
}
```

Field names must match the form's declared schema exactly (case-sensitive).
Extra fields are stored in `unexpected_data` and trigger schema-drift
detection — they are not rejected.

The CAPTCHA token field (`cf-turnstile-response`, `_captcha`,
`g-recaptcha-response`, or `h-captcha-response`) is consumed by the CAPTCHA
stage and stripped from the stored submission.

**`application/x-www-form-urlencoded`**

Standard HTML form encoding. Repeated keys for the same field name become
arrays. Use this when posting from a plain HTML `<form>` without file uploads.

**`multipart/form-data`**

Required when the form includes `file`-type fields. Do not set `Content-Type`
manually — let the browser or `FormData` API set it with the boundary
parameter.

#### Response: 202 Accepted

```json
{
  "ok": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "submissionId": "sub_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
}
```

HTTP 202 (not 200) because submission processing is async. The response means
the submission is durably stored and queued — not that email or webhooks have
been delivered.

**Response headers:**

| Header | Notes |
|--------|-------|
| `x-submitpulse-request-id` | UUID echoing `requestId`. Use for log correlation. |
| `Content-Type` | `application/json` |
| `X-Content-Type-Options` | `nosniff` |
| `Cache-Control` | `no-store` |
| `Access-Control-Allow-Origin` | Reflected origin when allowed by form's domain list |
| `Access-Control-Allow-Credentials` | `true` (when CORS origin is reflected) |
| `Access-Control-Expose-Headers` | `x-submitpulse-request-id` |
| `Vary` | `Origin` |

#### Error responses

All errors share this shape:

```json
{
  "ok": false,
  "requestId": "<uuid>",
  "error": {
    "code": "<SCREAMING_SNAKE>",
    "message": "<human-readable>",
    "fields": [
      {
        "field": "<field-name>",
        "code": "<error-code>",
        "message": "<field-specific message>"
      }
    ]
  }
}
```

`fields` is present **only** when `code` is `VALIDATION_ERROR`.

| HTTP | `error.code` | Cause |
|------|-------------|-------|
| 400 | `VALIDATION_ERROR` | Required field missing, type wrong, or constraint violated. `fields` array present. |
| 400 | `CAPTCHA_FAILED` | Turnstile token absent or server-side verification failed. |
| 400 | `SUBMISSION_BLOCKED` | Honeypot field populated or an explicit block rule matched. |
| 400 | `BAD_REQUEST` | Malformed JSON, unsupported Content-Type, or invalid multipart. |
| 403 | `ORIGIN_REJECTED` | Request origin not in the form's allowed list (when `enforce_origin` is true). |
| 404 | `FORM_NOT_FOUND` | No active form with that ID. Also returned for paused forms (existence not leaked). |
| 413 | `PAYLOAD_TOO_LARGE` | Body exceeds per-form limit or 26 MiB absolute ceiling. |
| 429 | `RATE_LIMITED` | Too many requests. See rate limits section. |
| 503 | `SERVICE_UNAVAILABLE` | DB write failure or captcha provider down. Retry with backoff. |

---

## Rate limits

Three independent limits are applied in order. All return `429 RATE_LIMITED`.
The response does not specify which limit fired.

| Limit | Threshold | Window |
|-------|-----------|--------|
| Per-IP global (across all forms) | 60 requests | 60 seconds |
| Per-IP per-form | 10 requests | 300 seconds (5 min) |
| Per-form ceiling | 500 requests | 60 seconds |

Retry strategy: wait at least 60 seconds; use exponential backoff with jitter.

The current production rate limiter is `InMemoryRateLimiter` — the swap to
Upstash Redis is **not yet implemented** (see `apps/ingest/src/index.ts`).

---

## Idempotency

To avoid duplicate submissions after network timeouts:

1. Generate a unique key: `crypto.randomUUID()`.
2. Send it in the `Idempotency-Key` header.
3. On timeout or 5xx, retry with the **same key**.
4. The server returns the original 202 and the original `submissionId`.
5. After a confirmed success, discard the key. Do not reuse it for a
   different, intentionally distinct submission.

Deduplication uses Cloudflare KV as a fast edge cache (24-hour TTL) backed by
a D1 fallback query. The KV namespace binding (`IDEMPOTENCY_KV`) must be
provisioned in the Cloudflare dashboard.

---

## Code examples

### JavaScript / TypeScript (JSON)

```typescript
const ENDPOINT = "https://api.submitpulse.com/v1/forms/fm_your_form_id/submissions";

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Idempotency-Key": crypto.randomUUID(), // prevent duplicates on retry
  },
  body: JSON.stringify({
    name: "Alice Johnson",
    email: "alice@example.com",
    message: "Hello",
  }),
});

if (!res.ok) {
  const json = await res.json() as { error?: { code: string; message: string } };
  console.error(json.error?.code, json.error?.message);
} else {
  const json = await res.json() as { submissionId: string };
  console.log("Accepted:", json.submissionId);
}
```

### File upload (FormData)

```typescript
const form = new FormData();
form.append("name", "Alice Johnson");
form.append("email", "alice@example.com");
form.append("resume", fileInput.files[0]);

// Do NOT set Content-Type — FormData sets it with the boundary parameter.
const res = await fetch(ENDPOINT, {
  method: "POST",
  body: form,
});
```

### Plain HTML form (URL-encoded, no JavaScript)

```html
<form action="https://api.submitpulse.com/v1/forms/fm_your_form_id/submissions"
      method="POST">
  <input name="name" required>
  <input name="email" type="email" required>
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
</form>
```

Plain HTML `<form>` with `method="POST"` sends `application/x-www-form-urlencoded`
by default. Redirect on success is the browser's default behaviour.

### Handling validation errors

```typescript
if (res.status === 400) {
  const body = await res.json();
  if (body.error?.code === "VALIDATION_ERROR") {
    for (const fieldErr of body.error.fields ?? []) {
      console.error(`${fieldErr.field}: ${fieldErr.message}`);
    }
  }
}
```

---

## Pagination (management API — not yet implemented)

When management endpoints are implemented, list responses will use cursor-based
pagination with this envelope:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 143,
    "totalPages": 8,
    "nextCursor": "opaque-cursor-string"
  }
}
```

---

## API keys (not yet implemented)

API key format:
- Production: `submitpulse_live_<random>` (from `brand.identifiers.apiKeyLive`)
- Test: `submitpulse_test_<random>` (from `brand.identifiers.apiKeyTest`)

Keys are hashed with SHA-256 before storage. Only the visible prefix
(e.g. `submitpulse_live_a1b2`) is stored in plaintext for identification in
the dashboard. The `api_keys` table in `packages/database/src/schema/platform.ts`
supports optional `scopes` (a `string[]` JSONB column), optional expiry, and
revocation timestamps.

No handler currently validates API keys.
