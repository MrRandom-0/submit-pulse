# 40 — Known Limitations

This file documents what does not work, what is unverified, and what is aspirational. Read it before making any claims about this system's capabilities. Nothing here is softened.

---

## Build environment — zero execution

**npm was firewalled for the entire development period. `pnpm install` has never completed. No `node_modules` directory exists anywhere in this repository.**

Consequences:

- TypeScript has never been compiled. `pnpm typecheck` has never run. Type errors may exist.
- ESLint has never run. Lint violations may exist.
- Prettier has never run in CI. Formatting may be inconsistent.
- **Zero tests have ever executed.** No passing test result exists. No failing test result exists. The test files produce no results of any kind.
- No production build has been produced (`pnpm build` has never run). No deployable artifact exists.
- `@submitpulse/browser` and `@submitpulse/react` have never been built or published to any npm registry.
- The GitHub Actions workflows in `.github/workflows/ci.yml` and `.github/workflows/e2e.yml` have never succeeded because they begin with `pnpm install --frozen-lockfile`, which requires registry access.

This is not a minor caveat. The entire product is source code that has never been executed against real services.

---

## Database — never provisioned, all 34 tables unverified

**No Supabase project has been created. The SQL migration `packages/database/migrations/0001_row_level_security.sql` has never been applied to any Postgres instance.**

- All 34 tables, all 18 enums, all constraints, all indexes, and all 96 RLS policies are unverified against a running database.
- `drizzle.config.ts` does not exist in the repository. `drizzle-kit push` cannot run.
- The RLS policy design (tenant context via `SET LOCAL app.workspace_id`, circular-RLS avoidance for audit_logs, `FORCE ROW LEVEL SECURITY`) is internally consistent as written SQL but has never been validated.
- The partial unique index on `integrations` (one per provider at workspace level, one per provider per form) is correct by design but untested.

---

## External services — no credentials exist for any

| Service | Status |
|---|---|
| Supabase (Auth + Postgres) | No project, no URL, no keys |
| Stripe | No account, no products, no webhook secret |
| Resend (email) | No account, no API key |
| Cloudflare Turnstile | No site configured, no site key or secret |
| Upstash Redis (rate limiting) | No account, no REST URL or token |
| Cloudflare R2 (file storage) | No bucket configured |
| Antivirus provider | No provider selected or integrated |
| Cloudflare D1 | No database created; wrangler.toml has placeholder IDs |
| Cloudflare KV | No namespace created; wrangler.toml has placeholder IDs |
| Cloudflare Queue | No queue created |

`apps/ingest/wrangler.toml` contains literal placeholder values: `REPLACE_WITH_D1_DATABASE_ID` and `REPLACE_WITH_KV_NAMESPACE_ID`. The worker cannot be deployed until these are replaced.

---

## Ingestion service — production path is a stub

`apps/ingest/src/repository/d1-form-repository.ts` is the production form repository. Every SQL-dependent method is a stub that throws or returns a fixture. The production form lookup path does not work.

When `ENVIRONMENT !== "production"`, the service uses `DevFormRepository` (returns one hardcoded fixture form). All pipeline stages run correctly in development mode. Nothing else does.

`InMemoryRateLimiter` is always active because no Upstash credentials exist. It stores state per-process, resets on every restart, and does not share state across Cloudflare Worker isolates. Rate limiting does not work correctly at scale.

---

## Worker service — 7 of 8 handlers are stubs

| Handler file | Status |
|---|---|
| `apps/worker/src/handlers/process-submission.ts` | Stub — logs and returns |
| `apps/worker/src/handlers/send-notification.ts` | Stub — logs and returns |
| `apps/worker/src/handlers/send-autoresponder.ts` | Stub — logs and returns |
| `apps/worker/src/handlers/deliver-webhook.ts` | Partial — HTTP call via `attemptDelivery()` works; all DB writes (INSERT to `webhook_deliveries`, UPDATE `consecutive_failures`, auto-disable logic) are TODO comments |
| `apps/worker/src/handlers/scan-file.ts` | Stub — logs and returns |
| `apps/worker/src/handlers/run-health-check.ts` | Stub — logs and returns |
| `apps/worker/src/handlers/enrich-analytics.ts` | Stub — logs and returns |
| `apps/worker/src/handlers/sweep-retention.ts` | Stub — logs and returns |

`deliver-webhook` makes a real HTTP call through the SSRF guard. No other side effects work.

---

## MCP server — handlers are stubs

Five of the seven MCP tools throw `"INCOMPLETE — API client not wired."`: `list_forms`, `get_form_config`, `get_schema`, `send_test_submission` (partial — network call present but token serialisation incomplete), and `check_form_health`. Only `generate_integration` and `validate_integration` are fully implemented.

`apps/mcp/src/auth.ts`: `verifyInstallationToken()` always returns `{ ok: false, error: "Token verification is not implemented." }`. No token can be verified.

---

## Web app dashboard — all data is invented

**All dashboard data comes from `apps/web/src/lib/dashboard-data.ts`.** This file exports async functions returning hardcoded arrays of invented data. No database queries exist in any dashboard route.

Fixture functions returning invented data:
- `getOverviewMetrics()` — invented submission counts, spam counts, health status, activity
- `listForms()` — 4 hardcoded forms with invented statistics
- `getForm(id)` — one of the 4 fixture forms
- `listSubmissions()` — 5 hardcoded submission summaries with invented names and emails
- `getSubmission(id)` — one hardcoded submission detail
- `getPlatformOverview()` (admin) — invented platform metrics

The dashboard looks functional. It is not.

---

## Authentication — no session can succeed

`resolveMembership()` in `packages/auth/src/session.ts` is marked INCOMPLETE and **always returns null**. Therefore:

- `getActor()` always returns null.
- `requireActor()` always redirects to `/login` or throws `AuthorizationError`.
- No authenticated user can perform any operation that calls `requireActor()`.

`setProvider()` — the call needed to initialise the auth provider singleton — does not exist anywhere in the web application codebase. The Supabase Auth provider is marked "INCOMPLETE — NOT PRODUCTION VERIFIED" and "must be integration-tested before production."

---

## INCOMPLETE-marked files by path

The following files contain explicit `INCOMPLETE` markers for functionality that must be built before deployment:

| File | What it needs |
|---|---|
| `apps/ingest/src/repository/d1-form-repository.ts` | All SQL queries for lookupForm, createSubmission, getSpamRules |
| `apps/worker/src/handlers/process-submission.ts` | Full implementation |
| `apps/worker/src/handlers/send-notification.ts` | Full implementation |
| `apps/worker/src/handlers/send-autoresponder.ts` | Full implementation |
| `apps/worker/src/handlers/deliver-webhook.ts` | Database writes (all DB operations are TODO) |
| `apps/worker/src/handlers/scan-file.ts` | Antivirus provider integration |
| `apps/worker/src/handlers/run-health-check.ts` | Headless browser execution |
| `apps/worker/src/handlers/enrich-analytics.ts` | Counter and UTM aggregate writes |
| `apps/worker/src/handlers/sweep-retention.ts` | Data purge sweeper |
| `apps/mcp/src/auth.ts` | `verifyInstallationToken()` — requires auth service |
| `apps/mcp/src/tools.ts` | `list_forms`, `get_form_config`, `get_schema`, `check_form_health` — API client |
| `packages/auth/src/session.ts` | `resolveMembership()` — real database query |
| `packages/auth/src/supabase-provider.ts` | Integration tested; marked NOT PRODUCTION VERIFIED |
| `apps/web/src/lib/dashboard-data.ts` | All fixture functions → real Drizzle queries |
| `apps/web/src/instrumentation.ts` | `setProvider()` call (file may not exist) |

---

## E2E tests — 22 tests are marked fixme

Every test in `apps/web/e2e/` that depends on real backend infrastructure is marked `test.fixme()`. These tests define the intended behaviour but cannot run until the full stack is deployed. Count by file:

| File | Fixme count |
|---|---|
| `billing.spec.ts` | 3 |
| `delivery.spec.ts` | 2 |
| `export-delete.spec.ts` | 2 |
| `file-upload.spec.ts` | 2 |
| `form-lifecycle.spec.ts` | 4 |
| `pulse-monitor.spec.ts` | 5 |
| `signup.spec.ts` | 1 |
| `spam-protection.spec.ts` | 2 |
| `workspace.spec.ts` | 1 |
| **Total** | **22** |

Zero E2E tests have ever produced a result — pass or fail.

---

## Load tests — zero results exist

Five k6 scripts exist in `load-tests/`: `submission-sustained.js`, `submission-burst.js`, `abusive-ip.js`, `many-forms.js`, `large-rejected.js`. **None have ever been executed.** The threshold values in those scripts (p95 < 300 ms, 413 fast-rejection < 100 ms) are design targets, not measured results. Do not quote them as benchmarks.

---

## Features listed in entitlements that are not implemented

| Feature | Entitlement key | Status |
|---|---|---|
| Stripe billing | (all plans) | Schema only; no checkout, no webhook handler, no `packages/billing/` source |
| Integration credentials encryption | (Pro, Agency) | Not implemented; `packages/security/` has no encryption module |
| Third-party integrations (Slack, Sheets, etc.) | `integrations` | Schema and enum only; no delivery handlers |
| Antivirus file scanning | `fileUploads` | Stub handler; no provider |
| Pulse Monitor execution | `pulseMonitor` | Stub handler; no headless browser |
| AI spam analysis | `advancedSpam` | Quota defined; no AI calls |
| AI schema repair | `aiRepair` | Prompt generation works; no live AI call |
| Website scanner | `scanner:run` | Permission defined; no scanner |
| MCP server (functional) | `mcpServer` | 5 of 7 handlers incomplete |
| Agency white-label reports | `whiteLabelReports` | Entitlement defined; no report generator |
| Client workspaces (UI) | `clientWorkspaces` | Schema and RLS present; no agency dashboard UI |

---

## Security — unverified controls

- RLS policies have not been tested against a live database. The design is correct on paper.
- The SSRF guard in `packages/security/src/ssrf.ts` has a documented DNS rebinding vulnerability: it resolves the hostname at check time but makes the fetch call later. An adversary can change DNS between resolution and connection.
- Integration credentials are intended to be envelope-encrypted. The encryption module does not exist.
- Stripe webhook signature verification is not implemented.
- No security audit by a qualified third party has been performed.
- No penetration test has been conducted.

**No compliance certification** (SOC 2, ISO 27001, GDPR adequacy, HIPAA) has been obtained or applied for. Do not make compliance claims.

---

## Summary

This codebase is a complete architectural design that has been authored in source code but never executed against real services. The design decisions are sound. The gap between the current state and a deployable product is large: install dependencies, typecheck, implement stubs, provision all infrastructure, verify RLS, wire authentication, and replace every fixture with real queries. `docs/39-release-checklist.md` itemises the gaps as actionable tasks.
