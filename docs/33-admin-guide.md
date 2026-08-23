# 33 — Admin Guide

## Access model

`users.is_platform_admin = true` is the only gate for admin routes. This flag can be set only by a database migration or a direct database update; it is never settable through any product UI. The `(admin)` route group in `apps/web/src/app/(admin)/` renders a `AdminGate` component that checks this flag server-side.

Platform admins are **not** superusers. The `can()` function in `packages/auth/src/permissions.ts` is explicit:

> "Platform admins deliberately do NOT get implicit access to tenant data here. Support access to customer content requires an explicit, audited escalation rather than an ambient superuser bit."

By default, every admin screen shows metadata — counts, statuses, timestamps, error messages. **No submission field values are visible to admins by default.**

---

## The 14 admin routes

All routes live under `/admin`. The layout (`apps/web/src/app/(admin)/layout.tsx`) enforces the `is_platform_admin` check before rendering.

| Route | Source file | Purpose |
|---|---|---|
| `/admin` | `admin/page.tsx` | Platform overview: workspace counts, MRR, dead-letter count, security events in 24h, open incidents, avg processing ms |
| `/admin/users` | `admin/users/page.tsx` | Search users by email; view account status; suspend or restore via `SuspendUserButton` |
| `/admin/workspaces` | `admin/workspaces/page.tsx` | List workspaces; suspend, grant credits via `WorkspaceActions` |
| `/admin/forms` | `admin/forms/page.tsx` | List forms across all workspaces; pause individual forms via `PauseFormButton` |
| `/admin/subscriptions` | `admin/subscriptions/page.tsx` | Subscription status by workspace; plan, status, Stripe IDs |
| `/admin/usage` | `admin/usage/page.tsx` | Platform-wide usage metrics by metric type and time range |
| `/admin/security` | `admin/security/page.tsx` | `security_events` table: auth failures, anomalies, by kind/severity |
| `/admin/abuse` | `admin/abuse/page.tsx` | Abuse signals: volume spikes, flagged accounts |
| `/admin/jobs` | `admin/jobs/page.tsx` | `background_jobs` with `status='dead_letter'`; retry via `RetryJobButton` |
| `/admin/email` | `admin/email/page.tsx` | Transactional email delivery status |
| `/admin/webhooks` | `admin/webhooks/page.tsx` | Platform-wide webhook delivery failures across all workspaces |
| `/admin/incidents` | `admin/incidents/page.tsx` | Create, update, and resolve public status incidents; drives `status.submitpulse.com` |
| `/admin/feature-flags` | `admin/feature-flags/page.tsx` | Toggle flags via `FeatureFlagToggle`; supports global enable, workspace-level allow-list, and rollout percentage |
| `/admin/audit` | `admin/audit/page.tsx` | Full `audit_logs` viewer with action, actor, resource, timestamp |

All screens currently render fixture data from `apps/web/src/lib/admin-data.ts` (or equivalent). No live database queries are wired to any admin route.

---

## Data visible to admins by default

Admins see metadata, never submission content:

| Category | Visible | Not visible |
|---|---|---|
| Workspaces | Name, slug, plan, suspension status, member count | Submission field values |
| Forms | Name, submission count, spam count, health status | Submission bodies |
| Users | Email, verified status, MFA enrolled, created date | Any submission data |
| Jobs | Queue name, job type, error message, attempt count | Job payload contents |
| Security events | Kind, severity, IP, timestamp | Correlated submission bodies |
| Audit log | Action, actor type/label, resource type/id, timestamp, before/after state | - |

The "before/after" snapshots in `audit_logs` may contain configuration data (form settings, workspace name) but never submission bodies, because application code must not write submission content to the audit log.

---

## Audited escalation for submission content

When a customer support case genuinely requires reading submission content (e.g. the customer cannot access their account and needs their data retrieved), the following procedure applies. The procedure is documented here; the technical enforcement mechanism is not yet implemented.

1. **Initiate.** Create a support ticket documenting the customer's request, the reason access is needed, and the specific submissions or time range.

2. **Authorise.** A second staff member (not the requestor) reviews and approves the ticket.

3. **Record.** Before accessing data, write a row to `audit_logs`:
   ```
   action:       "support.submission_access"
   actor_type:   "support"
   actor_label:  "<staff email>"
   resource_type: "submission"
   resource_id:  "<submission id or workspace id>"
   metadata:     { ticket_id: "...", reason: "..." }
   ```

4. **Access.** Use Supabase's SQL editor (which runs as a superuser, bypassing RLS) to query the relevant rows. All SQL editor queries are logged by Supabase's query history.

5. **Deliver.** Provide the relevant data to the customer via the support channel, not by sharing dashboard access.

6. **Close.** The ticket records what was accessed and confirms the Supabase query log reference.

Any access to submission content that bypasses this procedure constitutes a policy violation and must be reported.

---

## Feature flags

The `feature_flags` table drives platform rollouts. Fields:

| Field | Type | Purpose |
|---|---|---|
| `key` | text UNIQUE | Flag identifier string, e.g. `"mcpServer"` |
| `description` | text | Human-readable description for the admin UI |
| `enabled_globally` | boolean | When true, all workspaces receive the flag |
| `enabled_workspace_ids` | jsonb `string[]` | Explicit allow-list for targeted rollout |
| `rollout_percent` | integer 0–100 | Percentage of workspaces (by ID hash) when not global |
| `updated_by_user_id` | uuid → users | Who changed this flag last |

Flags can be toggled via the `/admin/feature-flags` UI using the `FeatureFlagToggle` component. Only platform admins can see this route.

Rollout semantics: `enabled_globally = true` overrides all other fields. Otherwise, a workspace receives the flag if its ID is in `enabled_workspace_ids` OR if `hash(workspaceId) % 100 < rollout_percent`.

---

## Workspace suspension

Suspending a workspace sets `workspaces.suspended_at` and `workspaces.suspension_reason`. The ingestion service is designed to return 404 for suspended workspaces during form lookup (stage 2 of the pipeline). The check is coded in `lookupForm()` but requires `D1FormRepository` to be implemented.

The `WorkspaceActions` component on `/admin/workspaces` provides the suspension button. The reason is recorded for audit purposes and displayed to the workspace owner.

---

## Dead-letter job replay

Jobs in `background_jobs` with `status='dead_letter'` can be replayed from `/admin/jobs` using the `RetryJobButton`. The expected replay mechanism:

1. Set `status = 'pending'`.
2. Clear `failed_at` and `dead_lettered_at`.
3. Reset `attempts = 0`.
4. The worker picks up the job on its next poll.

The `RetryJobButton` component exists; the server action it calls is not yet implemented.

---

## Incident management

Creating an incident at `/admin/incidents` writes a row to the `incidents` table and triggers an alert email to configured recipients (template: `packages/email/src/templates/incident-alert.ts`). The status page at `status.submitpulse.com` reads from this table. The worker handler for sending alert emails is currently a stub.
