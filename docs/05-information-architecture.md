# 05 — Information Architecture

Source: `apps/web/src/app/` route layout (surveyed August 2025).

---

## URL structure — full route inventory

### Marketing (`(marketing)` route group)

```
/                               Home (marketing)
/product                        Product overview page
/features                       Features listing
/pricing                        Pricing and plan comparison
/security                       Security practices page
/spam-protection                Spam protection feature page
/form-monitoring                Form monitoring / Pulse Monitor feature page
/file-uploads                   File uploads feature page
/webhooks                       Webhooks feature page
/developers                     Developer-focused landing page
/agencies                       Agency-focused landing page
/ai-builders                    AI builder index (all supported builders)
/ai-builders/[builder]          Per-builder landing page
                                  builders: lovable, bolt, v0, cursor,
                                  claude-code, codex, replit
/contact                        Contact form
/privacy                        Privacy policy
/terms                          Terms of service
/docs                           Documentation index
/docs/[slug]                    Individual documentation page
/docs/api                       API reference (EndpointCard components)
/docs/webhook-reference         Webhook reference
/status                         Platform status page (reads from incidents table)

/legal/acceptable-use           Acceptable use policy (draft)
/legal/dpa                      Data Processing Agreement (draft)
/legal/subprocessors            Sub-processor list (draft)
/legal/security-practices       Security practices overview (draft)
```

### Auth (`(auth)` route group)

```
/login                          Email/password login
/signup                         Account registration
/verify-email                   Email verification gate
/reset-password                 Password reset request
/reset-password/confirm         New password entry
/logout                         Session termination
```

### Onboarding (`(onboarding)` route group)

```
/onboarding                     New user setup wizard
```

### Dashboard (`(dashboard)` route group)

```
/overview                       Workspace overview (metrics, recent activity)
/forms                          Form list
/forms/[formId]                 Form detail (fields, domains, settings)
/submissions                    Workspace-wide submission inbox
/submissions/[submissionId]     Submission detail
/pulse                          Pulse Monitor dashboard
/integrations                   Webhooks and third-party integrations
/team                           Workspace members and invitations
/usage                          Usage metrics and quota meters
/billing                        Subscription management
/settings                       Workspace settings
```

### Admin (`(admin)` route group — requires `is_platform_admin`)

```
/admin                          Platform overview
/admin/users                    User management (suspend/restore)
/admin/workspaces               Workspace management
/admin/forms                    Form management (pause)
/admin/subscriptions            Subscription status
/admin/usage                    Platform-wide usage
/admin/security                 Security events
/admin/abuse                    Abuse signals
/admin/jobs                     Dead-letter job queue (with retry)
/admin/email                    Transactional email status
/admin/webhooks                 Platform-wide webhook failures
/admin/incidents                Incident management (drives /status page)
/admin/feature-flags            Feature flag management
/admin/audit                    Full audit log viewer
```

---

## Navigation hierarchy (dashboard)

```
Workspace
├── Overview
├── Forms
│   └── Form detail
│       ├── Fields / Schema
│       ├── Domains (allowed origins)
│       ├── Notifications (email destinations)
│       ├── Autoresponder
│       └── Settings
├── Submissions (workspace-wide inbox)
│   └── Submission detail
│       ├── Field values
│       ├── Provenance (IP, UA, origin, country, UTM)
│       ├── Spam signals
│       ├── Processing timeline
│       ├── Files
│       ├── Notes
│       ├── Tags
│       └── Delivery status
├── Pulse Monitor
│   └── Per-monitor: run history, incidents
├── Integrations
│   ├── Webhook endpoints
│   └── Third-party (Slack, Sheets, Airtable, etc.)
├── Team
├── Usage
├── Billing
└── Settings
```

---

## Key data relationships (conceptual)

```
Workspace
├── Forms (up to plan quota)
│   ├── FormDomains (allowed origins)
│   ├── FormEndpoints (public IDs with rotation support)
│   ├── FormSchemaVersions (immutable history)
│   ├── FormFields (current editable set)
│   ├── Submissions
│   │   ├── SubmissionEvents (processing timeline)
│   │   ├── SubmissionFiles
│   │   ├── SubmissionTags
│   │   ├── SubmissionNotes
│   │   └── SpamDecisions
│   ├── EmailDestinations
│   ├── Autoresponder (one per form)
│   ├── WebhookEndpoints
│   │   └── WebhookDeliveries
│   ├── Integrations (Slack, Sheets, Zapier, etc.)
│   ├── HealthMonitor (one per form)
│   │   ├── HealthRuns
│   │   └── Incidents
│   └── SchemaDriftEvents
├── WorkspaceMembers
│   └── (role: owner | admin | developer | viewer)
├── Invitations
├── ApiKeys
├── InstallationTokens
├── Subscription (one per workspace)
├── UsageEvents (metering ledger)
├── AuditLogs
└── SpamRules (workspace-level or form-scoped)
```

### Agency workspace hierarchy

```
Agency workspace (kind='standard')
└── Client workspace (kind='client', parent_workspace_id → agency)
    └── Client workspace (kind='client', parent_workspace_id → agency)
```

Agency members have read access to client workspaces via the `parent_workspace_id` join in RLS.

---

## Platform-level tables (not workspace-scoped)

| Table | Purpose |
|---|---|
| `users` | Authenticated user identities |
| `security_events` | Platform-wide security event log |
| `feature_flags` | Global feature rollout control |
| `background_jobs` | Dead-letter and admin visibility mirror for queue jobs |
