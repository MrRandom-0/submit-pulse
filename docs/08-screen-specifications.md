# 08 — Screen Specifications

> **Status**: All dashboard and admin screens render fixture data from `apps/web/src/lib/dashboard-data.ts`. The web app has never been built or run in a browser. Screen layouts exist as Next.js page source files; visual rendering is unverified.

---

## Dashboard

### Overview (`/overview`)

**Source**: `apps/web/src/app/(dashboard)/overview/page.tsx`
**Data source**: `getOverviewMetrics()` (fixture)

Sections:
- Metric cards: submissions today, submissions this month, spam blocked this month, active forms, forms healthy, failed deliveries, average processing time.
- Usage meters: submissions used vs quota, forms used vs quota.
- Form health summary: list of forms with health status dot and last submission time.
- Recent activity timeline.
- Latest submissions list (5 most recent).

### Forms list (`/forms`)

**Source**: `apps/web/src/app/(dashboard)/forms/page.tsx`
**Data source**: `listForms()` (fixture — 4 hardcoded forms)

FormCard components per form showing: name, health status badge, submission count, spam blocked count, CAPTCHA enabled indicator, origin enforcement indicator.

### Form detail (`/forms/[formId]`)

**Source**: `apps/web/src/app/(dashboard)/forms/[formId]/page.tsx`
**Data source**: `getForm(id)` (fixture)

Tabs:
- **Overview**: submission count, spam rate, last submission timestamp, health status.
- **Fields**: ordered field definitions with type, required flag, sensitive flag, internal flag.
- **Domains**: allowed origin list with host, subdomain flag, preview-domain flag.
- **Settings**: redirect URL after submission, body size limit, localhost allowance, retention override.

### Submissions inbox (`/submissions`)

**Source**: `apps/web/src/app/(dashboard)/submissions/page.tsx`
**Data source**: `listSubmissions()` (fixture — 5 hardcoded rows)

Filter bar: formId, status, spam verdict, full-text search (fixture data filtered in-memory; production should use the GIN index on `submissions.data`).

Each row — SubmissionRow component: public ID, form name, spam badge, status badge, country code, timestamp, preview of first two field values.

### Submission detail (`/submissions/[submissionId]`)

**Source**: `apps/web/src/app/(dashboard)/submissions/[submissionId]/page.tsx`
**Data source**: `getSubmission(id)` (fixture)

Sections:
- **Field values**: rendered as a key-value table. Dashboard comment: "never as HTML" — text-only to prevent XSS.
- **Provenance**: IP address, user agent, referrer, origin header, country code, UTM parameters.
- **Spam**: verdict badge, numeric score, signal list (code, label, weight, evidence string).
- **Processing timeline**: ordered `submission_events` rows with kind, message, duration_ms.
- **Files**: uploaded files with scan status badge.
- **Notes**: internal notes thread.
- **Tags**.
- **Delivery status**: per-destination email status and per-endpoint webhook status.

### Pulse Monitor (`/pulse`)

**Source**: `apps/web/src/app/(dashboard)/pulse/page.tsx`

Intended content (no fixture data wired to this route):
- List of health monitors with current status, uptime percentage, last run timestamp.
- Per-monitor: run history steps, step-by-step failure breakdown, open incidents.

### Integrations (`/integrations`)

**Source**: `apps/web/src/app/(dashboard)/integrations/page.tsx`

Intended content:
- Webhook endpoints list: URL, delivery success rate, last delivery status, retry controls.
- Third-party integrations: per-provider status card. Provider list from `integration_provider` enum: slack, discord, telegram, google_sheets, airtable, notion, zapier, make, generic_webhook.

### Team (`/team`)

**Source**: `apps/web/src/app/(dashboard)/team/page.tsx`

Member list with role badges. Invite form. Role assignment respects rank enforcement: an actor may only assign or modify members with a strictly lower rank (`canManageMemberWithRole` in `permissions.ts`).

### Usage (`/usage`)

**Source**: `apps/web/src/app/(dashboard)/usage/page.tsx`

Usage events from `usage_events` table. Quota meters per dimension (submissions, forms, members, storage, health tests, AI analyses).

### Billing (`/billing`)

**Source**: `apps/web/src/app/(dashboard)/billing/page.tsx`

Current plan from `subscriptions` table. Plan comparison cards. Upgrade flow (Stripe checkout — not wired). Requires `billing:read` permission to view; `billing:manage` to change.

### Settings (`/settings`)

**Source**: `apps/web/src/app/(dashboard)/settings/page.tsx`

Workspace name, slug. Branding overrides (Agency plan only). Data retention configuration. Workspace deletion (owner only, requires `workspace:delete` permission).

---

## Auth screens

### Login (`/login`)

**Source**: `apps/web/src/app/(auth)/login/page.tsx`

Email/password form. Auth via Supabase Auth (stub). "Forgot password" link → `/reset-password`.

### Signup (`/signup`)

**Source**: `apps/web/src/app/(auth)/signup/page.tsx`

Registration form. Password policy from `packages/auth/src/password-policy.ts` enforced client-side and server-side.

### Email verification (`/verify-email`)

**Source**: `apps/web/src/app/(auth)/verify-email/page.tsx`

Gate shown after registration. Waits for email verification click before allowing dashboard access. Uses `users.email_verified_at`.

### Reset password (`/reset-password`, `/reset-password/confirm`)

**Source**: `apps/web/src/app/(auth)/reset-password/page.tsx`, `.../confirm/page.tsx`

Two-step: request form → confirmation link via email → new password entry form.

---

## Onboarding wizard (`/onboarding`)

**Source**: `apps/web/src/app/(onboarding)/onboarding/page.tsx`

New user wizard. Steps inferred from the product flow: create first form, choose builder, receive integration prompt, copy integration, confirm first submission received.

---

## Admin screens (requires `is_platform_admin`)

All 14 admin screens use the AdminMetricCard component and fixture data from the admin data module. None are wired to live queries.

### Admin overview (`/admin`)

Key metrics in a 4-column grid: total workspaces, suspended workspaces, total forms, submissions today, submissions this month, MRR, dead-lettered jobs, security events in 24h, new workspaces today, avg processing ms, open incidents.

Quick-action links grid to all 13 sub-routes.

### Other admin screens

| Route | Primary content |
|---|---|
| `/admin/users` | Search box; table with email, verified, MFA, role, status; SuspendUserButton |
| `/admin/workspaces` | Table with name, plan, member count, status; WorkspaceActions |
| `/admin/forms` | Table with form name, workspace, submission count, status; PauseFormButton |
| `/admin/subscriptions` | Table with workspace, plan, status, Stripe IDs, period |
| `/admin/usage` | Usage metrics table, filterable by metric type |
| `/admin/security` | security_events table: kind, severity, IP, timestamp |
| `/admin/abuse` | Abuse signal list: account flags, volume anomalies |
| `/admin/jobs` | Dead-letter jobs table: queue, type, error, attempts; RetryJobButton |
| `/admin/email` | Email delivery status table |
| `/admin/webhooks` | Platform-wide webhook delivery failures |
| `/admin/incidents` | Incident list with status; create/update/resolve controls |
| `/admin/feature-flags` | Flag table with toggle (FeatureFlagToggle), rollout percent, workspace list |
| `/admin/audit` | Audit log table: action, actor type/label, resource, timestamp |
