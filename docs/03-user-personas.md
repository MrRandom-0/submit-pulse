# 03 — User Personas

Sources: `packages/config/src/builders.ts`, `packages/config/src/entitlements.ts`, `packages/auth/src/permissions.ts`, `apps/web/src/app/(marketing)/agencies/page.tsx`, `apps/web/src/app/(onboarding)/onboarding/page.tsx`.

---

## Persona 1: The AI builder user

**Who they are.** Someone who generated a site with Lovable, Bolt, v0, Cursor, Claude Code, Codex, Replit, Framer, or Webflow. They may have basic HTML/CSS literacy but do not write or debug backend code. Their site is deployed; the form does not work.

**Job to be done.** Add a working contact form in a single session without leaving the AI tool and without provisioning a server.

**Pain point.** When they ask their AI builder to "add a contact form", the builder either generates a fake `<form action="">` that submits nowhere, wires to an email service the user has no account for, or writes server code that silently fails on a static host.

**How Submit Pulse addresses this.** The user creates a form, selects their builder, and receives an integration prompt tailored to that builder. The builder registry (`packages/config/src/builders.ts`) records a `snippetFlavour` (html, react, nextjs) and builder-specific `caveats`:

- **Lovable**: "Lovable regenerates components on subsequent prompts. Ask it to keep the integration in a dedicated file so a later redesign does not silently drop it."
- **Bolt**: "Bolt may rewrite the whole project on a broad prompt. Scope the request to the form component only."
- **v0**: "v0 works one component at a time. Paste this while the form component is the active generation."

The user pastes the prompt. The builder produces a wired form. No backend code written.

**Product surfaces they use.**
- `/ai-builders/[builder]` — per-builder landing page.
- Onboarding wizard (`/onboarding`) — creates their first form.
- Dashboard overview (`/overview`) — confirms submissions are arriving.
- Submission inbox (`/submissions`) — reads what was submitted.

**Plan.** Free (2 forms, 100 submissions/month) or Starter ($9/month, 10 forms, 1,000 submissions/month).

**Permission role.** Owner of their workspace. Single member (`members: 1` on Free).

---

## Persona 2: The developer

**Who they are.** A software engineer building with Next.js, React, Vue, Svelte, or Astro. They understand HTTP, JSON, and environment variables. They may already have a form backend — fragile, poorly observed, or expensive to maintain.

**Job to be done.** Replace a custom form handler or third-party service with something that has observability: submission timelines, spam signals, schema drift alerts, webhook delivery logs, and a health monitor that confirms the form still works after deploys.

**Pain point.** Custom backends break silently after framework upgrades. Third-party services lack per-submission event timelines and make it hard to debug "why did my webhook fail at 3 am?".

**How Submit Pulse addresses this.** The developer installs `@submitpulse/browser` (browser SDK) or `@submitpulse/react` (React hook wrapper), configures webhooks with HMAC signing, and enables Pulse Monitor to run synthetic end-to-end tests against their deployed site.

Key developer-facing surfaces:

| Surface | Route | Purpose |
|---|---|---|
| Form detail — fields tab | `/forms/[formId]` | Define schema, set required/sensitive flags |
| Form detail — domains tab | `/forms/[formId]` | Allowlist origins by host or subdomain |
| Webhook log | `/integrations` | Delivery success/failure history with replay |
| Submission detail | `/submissions/[id]` | Processing timeline, spam signals, files |
| Pulse Monitor | `/pulse` | Health run history and open incidents |
| API keys | `/settings` | Mint/revoke programmatic credentials |

**Permissions.** Developer role grants: `form:create`, `form:update`, `api_key:create`, `webhook:manage`, `webhook:replay`, `scanner:run`, `ai_repair:generate`, `submission:read`, `submission:update`. Does **not** grant `submission:export` (bulk egress is owner/admin authority).

**Plan.** Pro ($29/month): 50 forms, 10,000 submissions/month, 10 members, 365-day history, file uploads (25 GB), Pulse Monitor, schema drift, AI repair, MCP server, integrations.

---

## Persona 3: The agency

**Who they are.** A web agency managing 20–200 client sites. Each client is a separate entity; their data must not comingle. The agency wants to offer form infrastructure as a managed service and produce branded reports.

**Job to be done.** Manage all client forms from one dashboard. Provision isolated client workspaces. Bill clients for the service. Produce white-label health and submission reports.

**Pain point.** Per-client SaaS accounts are expensive and hard to audit. Logging into 40 different accounts to check form health is not feasible. Clients want a report with the agency's branding, not a third-party product's logo.

**How Submit Pulse addresses this.** The Agency plan enables `clientWorkspaces`, `agencyDashboard`, and `whiteLabelReports`. The workspace hierarchy is:

```
Agency workspace (kind='standard')
└── Client workspace (kind='client', parent_workspace_id → agency)
└── Client workspace (kind='client', parent_workspace_id → agency)
```

The RLS policy grants agency members read access to client workspaces via the `parent_workspace_id` join. Agency members cannot cross into unrelated workspaces.

**Product surfaces.**
- `/overview` — aggregate view across managed workspaces (agency dashboard).
- `/forms` and `/submissions` — scoped per-workspace or cross-workspace.
- `/team` — manage agency members across workspaces; role assignment follows strict rank enforcement (`canManageMemberWithRole` in `permissions.ts`).
- `/settings` — branding overrides for white-label.
- White-label report generator — defined in entitlements, not yet implemented.

**Plan.** Agency ($79/month): 250 forms, 50,000 submissions/month, 25 members, 730-day history, 150 GB file storage, 100,000 health tests/month, priority support.

---

## Persona 4: The platform administrator

**Who they are.** A Submit Pulse staff member responsible for platform operations, abuse response, and incident management.

**Job to be done.** Monitor platform health, respond to abuse signals, manage feature rollouts, resolve dead-letter jobs, and manage billing escalations — all without gaining ambient access to tenant submission content.

**How Submit Pulse addresses this.** The `users.is_platform_admin = true` flag (set only by direct database update, never through the product UI) unlocks 14 routes under the `/admin` prefix.

**The critical constraint.** Platform admins do **not** get implicit access to tenant data. The `can()` function in `packages/auth/src/permissions.ts` is explicit: "Support access to customer content requires an explicit, audited escalation rather than an ambient superuser bit." An admin reading a workspace's submissions requires a documented ticket, a record written to `audit_logs` with `actor_type='support'`, and a temporary grant via a process not yet designed. By default, the admin UI exposes metadata (counts, status, timestamps) not content.

**Admin routes** (from `apps/web/src/app/(admin)/`):

| Route | Purpose |
|---|---|
| `/admin` | Platform overview: workspace counts, MRR, dead-letter jobs, security events |
| `/admin/users` | Search, inspect, suspend, restore user accounts |
| `/admin/workspaces` | Suspend workspaces, grant credits |
| `/admin/forms` | Pause individual forms |
| `/admin/subscriptions` | Subscription status overview |
| `/admin/usage` | Platform-wide usage metrics |
| `/admin/security` | Auth failures, anomalies from `security_events` |
| `/admin/abuse` | Volume spikes, flagged accounts from `abuse_signals` |
| `/admin/jobs` | Dead-letter queue; retry button per job |
| `/admin/email` | Transactional email delivery status |
| `/admin/webhooks` | Platform-wide webhook delivery failures |
| `/admin/incidents` | Create and manage public status incidents |
| `/admin/feature-flags` | Toggle feature flags with workspace targeting |
| `/admin/audit` | Full audit log viewer |

**Data shown to admins.** Metadata only: counts, timestamps, status flags, error messages. No submission field values.
