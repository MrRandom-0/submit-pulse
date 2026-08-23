# 26 — Privacy and Data Retention

## Data collected per submission

For every form submission, the following personal data may be collected:

| Field | Where stored | Notes |
|---|---|---|
| Submitted field values | `submissions.data` (jsonb) | May include name, email, phone, any user-supplied content. |
| IP address | `submissions.ip_address` | Stored truncated/normalised. |
| User agent | `submissions.user_agent` | |
| Referrer | `submissions.referrer` | |
| Origin header | `submissions.origin_header` | |
| Country code | `submissions.country_code` | Derived from IP; 2-letter ISO code. |
| UTM parameters | `submissions.utm_*` columns | Marketing attribution. |
| Fingerprint | `submissions.fingerprint` | SHA-256 of (IP + user agent + form ID). Not a personal identifier in isolation. |

## Data collected for security events

`security_events.email` stores the attempted email address on failed login for brute-force detection. This field is purged by the retention job before long-term archival to avoid storing third-party addresses indefinitely.

## Retention

### Plan defaults

| Plan | History limit |
|---|---|
| Free | 7 days |
| Starter | 30 days |
| Pro | 365 days |
| Agency | 730 days (2 years) |

These are defined in `packages/config/src/entitlements.ts` as `historyDays` quotas.

### Override hierarchy

1. Per-form `forms.retention_days_override` (most specific).
2. Per-workspace `workspaces.retention_days_override`.
3. Plan default.

Configuring retention overrides requires the `data:configure_retention` permission (admin and owner only).

### Retention sweep

The `sweep-retention` worker handler is responsible for:
1. Setting `submissions.purge_after` on rows that have exceeded their retention window.
2. Hard-deleting rows where `purge_after < now()` after a grace period.

The handler is a stub; no retention enforcement runs.

### Soft vs hard deletion

`submissions.deleted_at` is set on soft delete. Rows with `deleted_at` set are hidden from the inbox but are recoverable within the retention window. After `purge_after` is reached, the `sweep-retention` job hard-deletes the row.

`submission_files` follow the same pattern: `deleted_at` → `purge_after` → hard delete. File storage deletion must accompany database row deletion.

## Data export

`data:export_workspace` permission (admin and owner) allows bulk export of submission data. The export format is not yet defined; no export handler exists.

`submission:export` permission is required for per-submission exports. Developer role does NOT have this permission; bulk egress requires admin or owner.

## Account deletion

`users.deleted_at` is set on account deletion (soft delete). The account is retained briefly to honour a grace period (configurable; currently not enforced). After the grace period, rows are hard-deleted.

Workspace deletion cascades to all workspace-scoped data via the `ON DELETE CASCADE` foreign key constraints.

## Third-party data sharing

Submission data is shared with:
- Email notification recipients (configured per form, verified).
- Autoresponder recipients (the submitter's own address, from a form field).
- Webhook endpoint operators (customer-configured; delivery is opt-in per event type).
- Third-party integration destinations (Slack, Google Sheets, etc.) when configured.

The platform does not share submission data with advertising networks or data brokers.

## Synthetic submission exclusion

Pulse Monitor synthetic submissions (`origin='synthetic'`) are excluded from all user-facing analytics, reports, and exports. They are subject to the same retention rules as live submissions.

## Audit log retention

`audit_logs` is append-only. Application code may only INSERT. The schema comment states that rows are moved to cold storage and hard-deleted after a retention window by a separate archival job. That job does not exist yet.

## Legal documents

Legal documents are Next.js pages in the marketing section of the web app:
- `/privacy` → `apps/web/src/app/(marketing)/privacy/page.tsx`
- `/terms` → `apps/web/src/app/(marketing)/terms/page.tsx`

The content of these pages requires reading the source files directly; the documents have not been legally reviewed.
