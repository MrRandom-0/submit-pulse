# 01 — Product Overview

## What Submit Pulse is

Submit Pulse is a form-infrastructure SaaS. It provides a hosted backend for HTML forms on AI-generated and static websites. Website owners point their form's `action` attribute or JavaScript `fetch` call at a Submit Pulse endpoint. The platform handles receipt, spam filtering, delivery, and monitoring.

The product's core positioning: it knows which AI builder or framework generated the site, and it produces a working integration prompt the user pastes directly into that tool. The form is wired without the user writing any server code.

From `packages/config/src/brand.ts`:

- **Tagline**: "Forms that never fail silently."
- **Developer tagline**: "Form infrastructure built for AI-generated websites."
- **Description**: "Submit Pulse gives AI-built and static websites a secure form backend without requiring developers to build server infrastructure."

---

## What the platform does

### 1. Receives form submissions

Public HTTPS endpoint: `https://api.submitpulse.com/v1/forms/{publicFormId}/submissions`

Built on Cloudflare Workers. The `publicFormId` uses the prefix `fm_` (e.g. `fm_a8f3...`). The form ID is public by design: domain rules and bot protection are the access controls, not ID secrecy.

### 2. Validates and filters (synchronous pipeline)

The ingestion pipeline in `apps/ingest/src/` runs these stages in order:

1. **Size guard** — rejects bodies over the configured limit before reading further.
2. **Form lookup** — fetches form configuration from D1 (production) or a fixture (development). Returns 404 for paused or suspended forms.
3. **Rate limiting** — per-IP-per-form window using Upstash Redis (production) or an in-memory limiter (development).
4. **Origin check** — compares the `Origin` request header against `form_domains`. Rejects mismatches with 403.
5. **Schema validation** — validates fields against the form's active schema version. Returns 422 with per-field errors on mismatch.
6. **CAPTCHA verification** — verifies Cloudflare Turnstile tokens when enabled. Bypassed in development.
7. **Spam scoring** — evaluates honeypot fields, header anomalies, and custom rules. Assigns a score and verdict.
8. **File validation** — checks MIME type via magic bytes, extension, and size for any uploaded files.
9. **Persist** — writes the submission with idempotency (KV-based dedup within a time window).
10. **Enqueue** — fires a job to the Cloudflare Queue for async processing.

The synchronous path returns 202 Accepted after step 10. Delivery and notifications happen asynchronously.

### 3. Delivers asynchronously

The queue consumer in `apps/worker/src/` handles eight job types:

| Job | Handler | Status |
|---|---|---|
| `process-submission` | Spam scoring, drift detection, analytics | Stub |
| `send-notification` | Email to configured destinations | Stub |
| `send-autoresponder` | Reply email to the submitter | Stub |
| `deliver-webhook` | POST to customer webhook endpoints | Partial |
| `scan-file` | Antivirus scan of uploaded files | Stub |
| `run-health-check` | Synthetic end-to-end Pulse Monitor test | Stub |
| `enrich-analytics` | Aggregate counters and UTM data | Stub |
| `sweep-retention` | Purge submissions past the retention window | Stub |

All handlers except `deliver-webhook` are stubs. See `docs/40-known-limitations.md`.

### 4. Monitors form health (Pulse Monitor)

Pulse Monitor periodically loads a customer's deployed page, locates the form, submits test data, and validates the end-to-end pipeline. The test submission carries `x-submitpulse-synthetic: 1` and is excluded from analytics. The `run-health-check` worker handler drives this; it is currently a stub.

### 5. Detects schema drift

When the live form sends field names that differ from the declared schema, the platform records the discrepancy in `schema_drift_events` and generates an AI repair prompt. The customer pastes the prompt into their builder to update the form. Schema drift detection runs in the `process-submission` worker handler (stub).

---

## What the platform does not do yet

The following are designed but not implemented. Full detail in `docs/40-known-limitations.md`.

- No live database. Dashboard displays fixture data.
- No Stripe billing. Subscription management is schema-only.
- No email delivery. Resend provider interface exists; no credentials configured.
- No Cloudflare Turnstile verification in production.
- No file storage backend. Validation runs; storage keys are never written to a real bucket.
- No Pulse Monitor execution. Worker handler shell exists; no headless browser runs.
- MCP server: snippet generation and validation work; 5 of 7 tools are stubs.
- SDKs exist as source code but have never been built or published.

---

## Application structure

| App | Technology | Purpose |
|---|---|---|
| `apps/ingest` | Cloudflare Workers + Hono | Public form submission endpoint |
| `apps/web` | Next.js 14 App Router | Dashboard, marketing, auth, onboarding, admin |
| `apps/worker` | Cloudflare Workers (queue consumer) | Async notification and delivery processing |
| `apps/mcp` | MCP SDK (stdio) | AI coding agent integration interface |

---

## Plans

Defined in `packages/config/src/entitlements.ts`. Prices are code constants; no Stripe products have been created.

| Plan | Price/month | Forms | Submissions/month | Members | History | File storage |
|---|---|---|---|---|---|---|
| Free | $0 | 2 | 100 | 1 | 7 days | 0 |
| Starter | $9 | 10 | 1,000 | 3 | 30 days | 0 |
| Pro | $29 | 50 | 10,000 | 10 | 365 days | 25 GB |
| Agency | $79 | 250 | 50,000 | 25 | 730 days | 150 GB |

Annual pricing: 10× the monthly price (two months free). Feature differences between plans are defined in `PLANS[id].features` — see `docs/24-billing.md` for the feature matrix.

---

## Security architecture (three layers)

The permission model in `packages/auth/src/permissions.ts` is explicit about defence in depth:

1. **Permission matrix** — answers "what may this role do?" via `can(actor, permission)`.
2. **Tenant scoping** — queries must filter by `workspace_id`. Not enforced automatically.
3. **Row Level Security** — Postgres RLS as a database-level backstop: "RLS exists because this layer can be bypassed by a bug."

All three layers must be intact for the system to be secure.
