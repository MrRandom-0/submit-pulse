# 18 — Health Monitoring (Pulse Monitor)

Source: `packages/database/src/schema/health.ts`, `apps/worker/src/handlers/run-health-check.ts`

## Overview

Pulse Monitor is a synthetic end-to-end health check. It periodically loads the customer's deployed page, finds the form, submits test data through the normal ingestion pipeline, and verifies each stage completes successfully.

The feature is gated behind the `pulseMonitor` entitlement (Pro and Agency plans). The `run-health-check` worker handler is a stub; no headless browser execution has occurred.

## Health monitors

One monitor per form (enforced by UNIQUE constraint on `health_monitors.form_id`).

### Configuration

| Field | Constraint | Notes |
|---|---|---|
| `target_url` | Must start with `https://` | SSRF-validated at fetch time. |
| `interval_minutes` | CHECK BETWEEN 5 AND 1440 | 5 minutes to 1 day. |
| `enabled` | boolean | Paused monitors do not run. |
| `notify_on_failure` | boolean | |
| `notify_emails` | jsonb array | Alert recipients. |

### Status

`current_status` uses the `health_status` enum: `healthy`, `degraded`, `failing`, `paused`, `setup_incomplete`.

`consecutive_failures` is incremented on each failing run and reset to 0 on any passing run.

Rolling `uptime_percent_30d` and `avg_latency_ms` are maintained by the reporting worker.

## Health runs

`health_runs` records each synthetic test execution. The schema is append-only for `sp_app`; only the worker (`sp_service`, BYPASSRLS) creates and updates run records.

### Stage breakdown

The `steps` column stores a jsonb array of per-stage outcomes:

```json
[
  { "name": "page_loaded", "ok": true, "durationMs": 1200, "detail": null },
  { "name": "form_located", "ok": true, "durationMs": 340 },
  { "name": "fields_matched", "ok": false, "durationMs": 12, "detail": "Expected 'email', found 'Email'" }
]
```

Canonical stage names: `page_loaded`, `form_located`, `fields_matched`, `endpoint_verified`, `submitted`, `api_accepted`, `processed`, `notified`.

`failure_stage` and `failure_reason` are top-level fields for quick filtering without parsing the steps array.

## Synthetic submissions

The `synthetic_submission_id` on `health_runs` links to a `submissions` row with `origin='synthetic'`. Synthetic submissions must be excluded from:
- Analytics and reporting.
- Autoresponder triggers.
- Third-party integration deliveries.
- Billable usage metering.

The `x-submitpulse-synthetic: 1` header on outbound health-check requests tells the ingestion service to mark the submission as synthetic.

## Incidents

`incidents` are opened when consecutive failures exceed a threshold. One incident per active failure period.

### Status transitions

CHECK constraint enforces consistency:
- `open` → `resolved_at IS NULL`
- `acknowledged` → `acknowledged_at IS NOT NULL AND resolved_at IS NULL`
- `resolved` → `resolved_at IS NOT NULL`

`acknowledged_at` requires `incident:acknowledge` permission. `resolved_at` requires `incident:acknowledge` or higher.

`auto_resolved = true` when Pulse detects recovery and closes the incident without human action.

### Timeline

`incidents.timeline` is a jsonb append-only log:

```json
[
  { "at": "2025-01-01T10:00:00Z", "kind": "synthetic_test_failed", "message": "form_located stage failed" },
  { "at": "2025-01-01T10:05:00Z", "kind": "alert_sent", "message": "Email sent to admin@example.com" }
]
```

Possible `kind` values include: `deployment_detected`, `synthetic_test_failed`, `alert_sent`, `repair_prompt_generated`, `form_restored`.

## Alert emails

Alert email template: `packages/email/src/templates/incident-alert.ts`.

`incident_alert` kind in `email_deliveries` bypasses marketing suppressions (same as billing emails).

## SSRF notice

The `health_monitors.target_url` is user-supplied and is fetched by the monitor worker. Every fetch must pass through `assertSafeEgressUrl()` from `packages/security/src/ssrf.ts`. Every redirect hop is re-validated. The DNS rebinding caveat applies (see `docs/25-security-threat-model.md`).

## Website scanner

The `scanner:run` permission exists for a related feature: scanning a deployed page for structural or accessibility issues (missing labels, broken form actions, etc.). This is distinct from Pulse Monitor. The `generateScannerFixPrompt()` function in `packages/config/src/integration-prompts.ts` generates a repair prompt when scanner issues are found. The scanner execution handler (`handleRunHealthCheck`) is a stub.
