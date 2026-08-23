# 27 — Observability

> **Current state**: No observability tooling is configured beyond Cloudflare's built-in Workers observability. Applications log to stdout via `console.log` / `console.error`. No tracing, metrics, alerting, or log aggregation is set up.

---

## What exists

### Cloudflare Workers observability (configured)

`apps/ingest/wrangler.toml`:

```toml
[observability]
enabled = true
head_sampling_rate = 1
```

This enables Cloudflare Logpush and Workers Trace Events at 100% head-sampling rate. It is the only observability configuration that exists in the codebase. It takes effect when the worker is deployed; no deployment has occurred.

### Structured console logging (implemented in source)

The ingestion service logs a structured object on each accepted submission:

```javascript
console.info("[ingest] accepted", {
  requestId,
  formId: form.id,
  publicId,
  processingMs,
  spam: spamEval.verdict,
  idempotent: persistResult.isIdempotentRepeat,
});
```

The worker logs handler start and failure:

```javascript
console.log(`[worker] dispatching job: ${job.type}`);
console.error(`[worker] handler failed`, { jobType, error });
```

### Request ID tracing

Every ingestion request is assigned a `requestId` (UUID). This is:

- Returned as `x-submitpulse-request-id` in the 202 response header.
- Stored in `submissions.request_id` (when persistence is implemented).
- Included in all log lines for that request.
- Passed to the queue job payload for end-to-end correlation.

A customer who reports a failed submission can provide the request ID for support lookup in Cloudflare log output.

### Database event log (`submission_events`)

`submission_events` is an append-only processing timeline per submission. Each row has `kind`, `message`, `detail`, and `duration_ms`. This is the primary debugging surface for "why did my notification not arrive?" questions.

**Currently**: worker handlers are stubs. No events are written to this table.

### Background job visibility (`background_jobs`)

`background_jobs` mirrors job state from the queue provider. Platform engineers can observe failures, trigger replays, and audit dead-letter jobs from the `/admin/jobs` route without direct queue access.

**Currently**: no worker handler writes to `background_jobs`.

### Health check endpoint

`GET /health` on the ingestion service returns:

```json
{ "ok": true, "service": "submitpulse", "ts": "2025-08-23T00:00:00.000Z" }
```

This endpoint exists and works in development. It can be polled by external uptime monitors once the worker is deployed.

---

## Intended observability stack (none configured)

For production, the following are commonly used with Cloudflare Workers:

| Layer | Intended tool | Status |
|---|---|---|
| Tracing | OpenTelemetry exporter → Honeycomb, Grafana Tempo, or similar | Not configured |
| Metrics | Cloudflare Analytics Engine or Prometheus via Cloudflare Workers Metrics | Not configured |
| Error tracking | Sentry (Workers-compatible DSN) | Not configured |
| Log aggregation | Cloudflare Logpush → R2 or external aggregator (Axiom, Grafana Loki) | Not configured |
| Alerting | PagerDuty, OpsGenie, or Slack alerts from above | Not configured |

---

## Incident alert emails

When a Pulse Monitor incident opens, an alert email is sent to configured addresses. Template: `packages/email/src/templates/incident-alert.ts`. The email worker handler is a stub; no alerts are sent.

---

## Status page

`/status` in `apps/web/src/app/(marketing)/status/page.tsx` reads from the `incidents` table (via `apps/web/src/app/(admin)/admin/incidents/page.tsx` management interface). The status page is intended to reflect the current operational state. No database is provisioned; the page renders fixture data.

---

## Dashboard metrics

The `/overview` dashboard page (`apps/web/src/app/(dashboard)/overview/page.tsx`) shows submission counts, spam rates, processing times, and form health from `getOverviewMetrics()`. This function returns hardcoded fixtures. No live metrics exist.
