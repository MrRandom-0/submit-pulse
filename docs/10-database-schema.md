# 10 — Database Schema

**Status**: Schema is defined in TypeScript/Drizzle ORM. The SQL migration has never been applied to any database instance. All constraints, indexes, and RLS policies are unverified.

Source files: `packages/database/src/schema/`

## Postgres enums

Defined in `packages/database/src/schema/enums.ts`.

| Enum | Values |
|---|---|
| `workspace_role` | `owner`, `admin`, `developer`, `viewer` |
| `workspace_kind` | `standard`, `client` |
| `invitation_status` | `pending`, `accepted`, `revoked`, `expired` |
| `form_status` | `active`, `paused`, `archived` |
| `field_type` | `text`, `email`, `phone`, `number`, `url`, `date`, `textarea`, `select`, `multiselect`, `checkbox`, `hidden`, `file` |
| `submission_status` | `new`, `viewed`, `qualified`, `in_progress`, `replied`, `closed`, `archived` |
| `submission_origin` | `live`, `test`, `synthetic` |
| `spam_verdict` | `clean`, `suspicious`, `spam`, `blocked` |
| `delivery_status` | `queued`, `sending`, `sent`, `delivered`, `bounced`, `failed`, `skipped` |
| `health_status` | `healthy`, `degraded`, `failing`, `paused`, `setup_incomplete` |
| `incident_status` | `open`, `acknowledged`, `resolved` |
| `incident_severity` | `critical`, `warning`, `info` |
| `drift_kind` | `field_added`, `field_removed`, `field_renamed`, `type_changed`, `required_changed`, `validation_changed`, `unexpected_payload` |
| `drift_resolution` | `unresolved`, `accepted`, `mapped`, `ignored` |
| `file_scan_status` | `pending`, `scanning`, `clean`, `infected`, `failed`, `quarantined` |
| `job_status` | `pending`, `running`, `succeeded`, `failed`, `dead_letter` |
| `subscription_status` | `trialing`, `active`, `past_due`, `canceled`, `incomplete`, `incomplete_expired`, `unpaid`, `paused` |
| `plan` | `free`, `starter`, `pro`, `agency` |
| `integration_provider` | `slack`, `discord`, `telegram`, `google_sheets`, `airtable`, `notion`, `zapier`, `make`, `generic_webhook` |
| `security_event_kind` | `login_success`, `login_failure`, `password_reset_requested`, `password_reset_completed`, `mfa_enrolled`, `mfa_challenge_failed`, `session_revoked`, `api_key_created`, `api_key_revoked`, `suspicious_activity`, `rate_limit_tripped`, `origin_rejected`, `abuse_suspension` |

## Tables

### identity.ts

#### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `auth_provider_id` | text NOT NULL | Opaque subject ID from auth provider (Supabase). Unique. |
| `email` | text NOT NULL | CHECK: must contain `@`. Case-insensitive unique index on `lower(email)`. |
| `email_verified_at` | timestamptz | |
| `display_name` | text | |
| `avatar_url` | text | |
| `is_platform_admin` | boolean NOT NULL default false | Gates `/admin`. Never settable via product UI. |
| `mfa_enrolled_at` | timestamptz | |
| `marketing_opt_in_at` | timestamptz | |
| `last_seen_at` | timestamptz | |
| `deleted_at` | timestamptz | Soft delete. |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

#### `workspaces`

The tenant boundary. Every customer row is reachable from a workspace.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text NOT NULL UNIQUE | `^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$` |
| `name` | text NOT NULL | |
| `kind` | workspace_kind NOT NULL default `standard` | |
| `parent_workspace_id` | uuid | Null for standard. Non-null for client workspaces (agency mode). CHECK: not self-referential. CHECK: `(kind='client') = (parent_workspace_id IS NOT NULL)`. |
| `plan` | plan NOT NULL default `free` | |
| `branding` | jsonb | `{logoUrl, accentColor, replyToEmail}`. Agency white-label. |
| `suspended_at` | timestamptz | Blocks ingestion when set. |
| `suspension_reason` | text | |
| `retention_days_override` | int | Falls back to plan default. |
| `deleted_at` | timestamptz | Soft delete. |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

#### `workspace_members`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL → workspaces | |
| `user_id` | uuid NOT NULL → users | |
| `role` | workspace_role NOT NULL default `viewer` | |
| `invited_by_user_id` | uuid → users SET NULL | |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

UNIQUE(`workspace_id`, `user_id`).

#### `invitations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL → workspaces | |
| `email` | text NOT NULL | |
| `role` | workspace_role NOT NULL | |
| `token_hash` | text NOT NULL UNIQUE | SHA-256 of plaintext token. Plaintext never stored. |
| `status` | invitation_status NOT NULL default `pending` | |
| `invited_by_user_id` | uuid → users SET NULL | |
| `expires_at` | timestamptz NOT NULL | CHECK > created_at. |
| `accepted_at` | timestamptz | |
| `accepted_by_user_id` | uuid → users SET NULL | |
| `created_at` | timestamptz NOT NULL | |

### forms.ts

#### `forms`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL → workspaces CASCADE | |
| `public_id` | text NOT NULL UNIQUE | `^fm_[A-Za-z0-9]{22,}$`. Not an auth secret; enumeration resistance only. |
| `name` | text NOT NULL | |
| `website_url` | text | Drives Pulse Monitor. |
| `status` | form_status NOT NULL default `active` | |
| `health_status` | health_status NOT NULL default `setup_incomplete` | Denormalised rollup. |
| `active_schema_version_id` | uuid | |
| `captcha_enabled` | boolean NOT NULL default false | |
| `honeypot_field_name` | text | |
| `enforce_origin` | boolean NOT NULL default false | |
| `allow_localhost` | boolean NOT NULL default true | |
| `max_body_bytes` | int NOT NULL default 1048576 | CHECK BETWEEN 1024 AND 26214400. |
| `file_uploads_enabled` | boolean NOT NULL default false | |
| `success_redirect_url` | text | CHECK: null OR starts with `https://`. |
| `retention_days_override` | int | CHECK > 0. |
| `submission_count` | int NOT NULL default 0 | Denormalised; maintained by worker. |
| `spam_blocked_count` | int NOT NULL default 0 | |
| `last_submission_at` | timestamptz | |
| `created_by_user_id` | uuid → users SET NULL | |
| `deleted_at` | timestamptz | Soft delete. |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

Indexes: `(workspace_id, status)`, `(workspace_id, health_status)`.

#### `form_domains`

Allowed origins. Host stored normalised (no scheme, no path, lowercased).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `form_id` | uuid NOT NULL → forms CASCADE | |
| `host` | text NOT NULL | CHECK: equals lower(host). CHECK: no `://`. CHECK: no `/`. |
| `include_subdomains` | boolean NOT NULL default false | |
| `is_preview_domain` | boolean NOT NULL default false | |
| `note` | text | |
| `created_at` | timestamptz NOT NULL | |

UNIQUE(`form_id`, `host`).

#### `form_endpoints`

Public IDs over time; supports rotation with grace period.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `form_id` | uuid NOT NULL → forms CASCADE | |
| `public_id` | text NOT NULL UNIQUE | |
| `is_primary` | boolean NOT NULL default true | |
| `retired_at` | timestamptz | |
| `retires_at` | timestamptz | Requests still accepted until this timestamp. |
| `rotation_reason` | text | |
| `created_at` | timestamptz NOT NULL | |

CHECK: `retires_at IS NULL OR retired_at IS NULL OR retires_at >= retired_at`.

#### `form_schema_versions`

Immutable snapshots of the expected field set.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `form_id` | uuid NOT NULL → forms CASCADE | |
| `version` | int NOT NULL | CHECK >= 1. UNIQUE(`form_id`, `version`). |
| `definition` | jsonb NOT NULL | `{fields: [{name, type, required, constraints?}]}` |
| `source` | text NOT NULL default `manual` | CHECK IN (`manual`, `onboarding`, `inferred`, `drift_accepted`, `scanner`). |
| `created_by_user_id` | uuid → users SET NULL | |
| `created_at` | timestamptz NOT NULL | |

#### `form_fields`

Current editable field set.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `form_id` | uuid NOT NULL → forms CASCADE | |
| `name` | text NOT NULL | Wire name. CHECK: `^[A-Za-z0-9_.\[\]-]{1,128}$`. UNIQUE(`form_id`, `name`). |
| `label` | text | |
| `type` | field_type NOT NULL default `text` | |
| `required` | boolean NOT NULL default false | |
| `position` | int NOT NULL default 0 | CHECK >= 0. |
| `constraints` | jsonb | `{min, max, minLength, maxLength, pattern, allowedValues, maxFileCount, maxFileSizeBytes, allowedMimeTypes}` |
| `is_internal` | boolean NOT NULL default false | Excluded from notifications and exports. |
| `is_sensitive` | boolean NOT NULL default false | Redacted in UI and exports. |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

### submissions.ts

#### `submissions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL → workspaces CASCADE | Denormalised for fast RLS (avoids join). |
| `form_id` | uuid NOT NULL → forms CASCADE | |
| `public_id` | text NOT NULL UNIQUE | `sub_` prefix. |
| `request_id` | text NOT NULL | Correlates logs end-to-end. |
| `idempotency_key` | text | UNIQUE(`form_id`, `idempotency_key`). Null = no dedup. |
| `status` | submission_status NOT NULL default `new` | |
| `origin` | submission_origin NOT NULL default `live` | `synthetic` = Pulse health check. |
| `data` | jsonb NOT NULL | Validated payload. GIN index for full-text search. |
| `unexpected_data` | jsonb | Fields present but absent from schema. |
| `schema_version_id` | uuid → form_schema_versions SET NULL | |
| `spam_verdict` | spam_verdict NOT NULL default `clean` | |
| `spam_score` | real NOT NULL default 0 | CHECK BETWEEN 0 AND 1. |
| `ip_address` | text | Truncated/normalised. Subject to retention. |
| `fingerprint` | text | SHA-256 of (ip + user agent + form). |
| `user_agent` | text | |
| `referrer` | text | |
| `origin_header` | text | |
| `country_code` | text | CHECK: `^[A-Z]{2}$`. |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | text | |
| `assigned_to_user_id` | uuid → users SET NULL | |
| `read_at` | timestamptz | |
| `processing_ms` | int | Synchronous pipeline wall time. |
| `deleted_at` | timestamptz | Soft delete. |
| `purge_after` | timestamptz | Hard deletion eligibility (set by retention job). |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

Indexes: `(form_id, created_at DESC)`, `(workspace_id, created_at DESC)`, `(form_id, status)`, `(form_id, spam_verdict)`, `(fingerprint, created_at DESC)`, `(request_id)`, `(purge_after)`, GIN on `data`.

#### `submission_events`

Append-only processing timeline.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `submission_id` | uuid NOT NULL → submissions CASCADE | |
| `kind` | text NOT NULL | e.g. `spam.evaluated`, `notification.email.sent` |
| `message` | text | Human-readable summary. |
| `detail` | jsonb | Structured detail. Must never contain credentials. |
| `duration_ms` | int | CHECK >= 0. |
| `actor_user_id` | uuid → users SET NULL | Null for system events. |
| `created_at` | timestamptz NOT NULL | |

Indexes: `(submission_id, created_at ASC)`, `(kind, created_at DESC)`.

#### `submission_files`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `submission_id` | uuid NOT NULL → submissions CASCADE | |
| `workspace_id` | uuid NOT NULL → workspaces CASCADE | |
| `field_name` | text NOT NULL | |
| `original_filename` | text NOT NULL | Display only. Never used as storage path. |
| `storage_key` | text NOT NULL UNIQUE | Server-generated. Format: `uploads/<hash>/<uuid>.<ext>`. |
| `storage_bucket` | text NOT NULL | |
| `size_bytes` | bigint NOT NULL | CHECK > 0. |
| `detected_mime_type` | text NOT NULL | Server-side magic-byte detection. |
| `declared_mime_type` | text | Browser-reported. May differ. |
| `content_hash` | text NOT NULL | SHA-256 hex. CHECK: `^[a-f0-9]{64}$`. |
| `scan_status` | file_scan_status NOT NULL default `pending` | |
| `scan_completed_at` | timestamptz | |
| `scan_result` | jsonb | `{engine, signature, detail}` |
| `deleted_at` | timestamptz | |
| `purge_after` | timestamptz | |
| `created_at` | timestamptz NOT NULL | |

#### `submission_tags`

UNIQUE(`submission_id`, `tag`). `tag` length CHECK BETWEEN 1 AND 64.

#### `submission_notes`

Append-with-edit. `body` CHECK BETWEEN 1 AND 10000 characters.

#### `spam_decisions`

One row per submission (UNIQUE on `submission_id`). Stores contributing signals as jsonb array `[{code, label, weight, evidence?}]`. Override fields: `overridden_by_user_id`, `overridden_at`, `override_verdict`.

CHECK: `(overridden_at IS NULL) = (override_verdict IS NULL)`.

#### `spam_rules`

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | uuid NOT NULL → workspaces CASCADE | |
| `form_id` | uuid → forms CASCADE | Null = applies to all forms in workspace. |
| `kind` | text NOT NULL | CHECK IN (`blocklist_term`, `blocklist_email`, `blocklist_ip`, `allowlist_email`, `regex`). |
| `target_field` | text | Null = any field. |
| `pattern` | text NOT NULL | Length CHECK BETWEEN 1 AND 512. |
| `weight` | real NOT NULL default 1 | CHECK BETWEEN -1 AND 1. Negative = allowlist. |
| `enabled` | boolean NOT NULL default true | |

### delivery.ts

#### `email_destinations`

UNIQUE(`form_id`, `email`). `verified_at` set after challenge-link click.

#### `email_deliveries`

Append-only delivery log. UNIQUE on `idempotency_key`. Status transitions managed by `sp_service` (BYPASSRLS); `sp_app` has INSERT/SELECT only.

`kind` CHECK IN (`notification`, `autoresponder`, `verification`, `invitation`, `billing`, `incident`).

#### `autoresponders`

One per form (UNIQUE on `form_id`). CHECK: at least one of `body_html` or `body_text` is non-null. CHECK: `delay_seconds >= 0`. CHECK: `reply_to_email IS NULL OR contains @`.

#### `webhook_endpoints`

`secret_hash` stores hashed HMAC secret. Plaintext shown once at creation; never stored. `consecutive_failures` incremented on each failure; reset on success. `disabled_at` set by worker when auto-disable threshold is reached.

#### `webhook_deliveries`

Append-only. `response_body_snippet` capped before storage to prevent unbounded growth. UNIQUE on `delivery_id`.

#### `integrations`

**Partial unique index design** (see comment in `delivery.ts`):

Standard Postgres UNIQUE constraints treat NULLs as distinct, so `UNIQUE(workspace_id, provider, form_id)` would permit two workspace-level rows (both `form_id IS NULL`) for the same provider. The schema uses two partial unique indexes instead:

```sql
UNIQUE INDEX ON integrations (workspace_id, provider) WHERE form_id IS NULL
UNIQUE INDEX ON integrations (workspace_id, provider, form_id) WHERE form_id IS NOT NULL
```

This enforces one workspace-level integration per provider while allowing per-form overrides.

`credentials` column must be envelope-encrypted at the application layer before writing. The database cannot enforce this; only the application layer can.

### health.ts

#### `health_monitors`

One per form (UNIQUE on `form_id`). `target_url` must start with `https://`. `interval_minutes` CHECK BETWEEN 5 AND 1440. Rolling `uptime_percent_30d` CHECK BETWEEN 0 AND 100.

**SSRF notice** (from schema comment): "`target_url` is USER-SUPPLIED and fetching it is SSRF-by-design. Every fetch MUST go through the shared egress allowlist."

#### `health_runs`

Append-only. `sp_app` has SELECT only; worker (`sp_service`, BYPASSRLS) manages run lifecycle. `status` CHECK IN (`passed`, `failed`, `error`, `skipped`). `steps` jsonb array: `[{name, ok, durationMs, detail?}]`. Canonical stage names: `page_loaded`, `form_located`, `fields_matched`, `endpoint_verified`, `submitted`, `api_accepted`, `processed`, `notified`.

`synthetic_submission_id` always points to a submission with `origin='synthetic'`. That submission must be excluded from billing, analytics, autoresponders, and integrations.

#### `incidents`

Status transitions validated by CHECK constraint:
- `open` → `resolved_at IS NULL`
- `acknowledged` → `acknowledged_at IS NOT NULL AND resolved_at IS NULL`
- `resolved` → `resolved_at IS NOT NULL`

`timeline` jsonb array: `[{at, kind, message}]`.

#### `schema_drift_events`

Drift is NEVER auto-applied. Resolution requires explicit user action. `to_schema_version_id` is set only when `resolution IN ('accepted', 'mapped')`.

### platform.ts

#### `api_keys`

`key_hash` stores SHA-256 of plaintext key. Plaintext shown once. `key_prefix` is a non-secret display value (e.g. `submitpulse_live_a1b2`).

#### `installation_tokens`

Short-lived credentials for AI coding agents during setup. `max_uses` default 10. Permitted operations are explicitly documented in the schema comment; notably: may NOT read submission data, billing, or membership.

#### `usage_events`

Metering ledger. `metric` CHECK IN (`submission_accepted`, `form_created`, `health_test`, `ai_analysis`, `storage_bytes`, `file_bandwidth_bytes`, `email_delivered`, `webhook_attempt`, `member_added`). Idempotency key prevents double-billing.

#### `subscriptions`

One per workspace (UNIQUE on `workspace_id`). Stripe webhook events are the authoritative source. `stripe_subscription_id` UNIQUE.

#### `audit_logs`

Append-only. Application code may only INSERT. `actor_type` CHECK IN (`user`, `api_key`, `system`, `support`).

#### `security_events`

`severity` CHECK IN (`info`, `warning`, `critical`).

#### `feature_flags`

Platform-level (not workspace-scoped). `rollout_percent` CHECK BETWEEN 0 AND 100. UNIQUE on `key`.

#### `background_jobs`

Dead-letter / admin visibility mirror for the queue. Writes are best-effort from the worker. UNIQUE on `idempotency_key`.

## RLS model

Source: `packages/database/migrations/0001_row_level_security.sql`

### Database roles

| Role | BYPASSRLS | Usage |
|---|---|---|
| `sp_app` | No | Web server and API processes |
| `sp_service` | Yes | Ingestion worker, background worker, platform jobs |
| `sp_analytics` | No | BI tooling with read-only access |

### Tenant context mechanism

The application sets two session-local variables at the start of every request:

```sql
SET LOCAL app.workspace_id = '<uuid>';
SET LOCAL app.user_id      = '<uuid>';
```

`SET LOCAL` scopes values to the current transaction; they clear at COMMIT/ROLLBACK, preventing context leakage across pooled connections.

Two `SECURITY DEFINER` helper functions read these settings:

```sql
app.current_workspace_id() RETURNS uuid
app.current_user_id()      RETURNS uuid
```

Both return NULL when the setting is unset (`missing_ok => true`). All RLS predicates treat NULL as a denial (no rows visible, no writes allowed).

### Policy design

- Separate policies per command (SELECT, INSERT, UPDATE, DELETE) for explicit control.
- `FORCE ROW LEVEL SECURITY` on every table so the table owner (if `sp_app`) is also subject to policies.
- Tables with a direct `workspace_id` column use simple equality predicates.
- Tables without `workspace_id` (e.g. `form_domains`, `submission_events`) use EXISTS subqueries through the parent table.
- Submission-related tables have `workspace_id` denormalised specifically to avoid the join in RLS predicates.
- `submission_events` and `email_deliveries` are INSERT/SELECT only for `sp_app` (append-only); the worker manages status transitions.
- `health_runs` is SELECT only for `sp_app`; the worker creates and updates run records.
- Agency mode: the `workspaces` SELECT policy grants visibility to client workspaces via a parent membership join. The workspace_members SELECT policy deliberately avoids joining back to workspaces to prevent circular RLS evaluation.
