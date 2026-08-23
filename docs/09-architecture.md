# 09 — Architecture

## System topology

```
Browser / AI-generated website
        │
        │  POST /v1/forms/{publicFormId}/submissions
        ▼
┌─────────────────────────────┐
│   apps/ingest               │  Cloudflare Workers (edge)
│   Hono HTTP framework       │  — synchronous 10-stage pipeline
│   D1 for submission storage │
│   KV for idempotency        │
│   Queue producer            │
└──────────────┬──────────────┘
               │  Cloudflare Queue (fire-and-forget)
               ▼
┌─────────────────────────────┐
│   apps/worker               │  Cloudflare Workers (queue consumer)
│   — process-submission      │  (stub)
│   — send-notification       │  (stub)
│   — send-autoresponder      │  (stub)
│   — deliver-webhook         │  (partial)
│   — scan-file               │  (stub)
│   — run-health-check        │  (stub)
│   — enrich-analytics        │  (stub)
│   — sweep-retention         │  (stub)
└──────────────┬──────────────┘
               │  external services
               ├── Resend (email)
               ├── Supabase Postgres (data — production target)
               ├── Stripe (billing)
               └── Upstash Redis (rate limiting)

Browser user (dashboard/admin)
        │
        │  HTTPS
        ▼
┌─────────────────────────────┐
│   apps/web                  │  Next.js 14 App Router
│   Supabase Auth             │  (stub, not wired)
│   Drizzle ORM → Postgres    │  (no DB queries wired to UI)
└─────────────────────────────┘

AI coding agent
        │
        │  MCP stdio transport
        ▼
┌─────────────────────────────┐
│   apps/mcp                  │  MCP SDK server
│   7 tools                   │  2 fully implemented
│   Installation token auth   │  verifyInstallationToken: INCOMPLETE
└─────────────────────────────┘
```

---

## apps/ingest

**Runtime**: Cloudflare Workers (V8 isolates). Node.js compatibility mode (`nodejs_compat` flag in `wrangler.toml`).

**Framework**: Hono.

**Bindings** (all currently placeholders):

| Binding | Type | wrangler.toml placeholder |
|---|---|---|
| `DB` | Cloudflare D1 | `REPLACE_WITH_D1_DATABASE_ID` |
| `IDEMPOTENCY_KV` | Cloudflare KV | `REPLACE_WITH_KV_NAMESPACE_ID` |
| `SUBMISSION_QUEUE` | Cloudflare Queue producer | Not yet created |

**Secrets** (not yet configured):
- `SP_TURNSTILE_SECRET_KEY`
- `SP_UPSTASH_REDIS_REST_URL`
- `SP_UPSTASH_REDIS_REST_TOKEN`

**Synchronous pipeline stages** (all implemented; production persistence is a stub):

1. Size guard
2. Form lookup (D1 in production, fixture in development)
3. Rate limiting (Upstash in production, InMemory in development)
4. Origin check
5. Schema validation
6. CAPTCHA verification (Turnstile in production, bypass in development)
7. Spam scoring
8. File validation
9. Persist to D1 with idempotency
10. Enqueue to Cloudflare Queue

**Development mode**: When `ENVIRONMENT !== "production"`, uses `DevFormRepository` (fixture form), `DevBypassCaptchaVerifier` (always passes), `InMemoryRateLimiter` (process-local). The pipeline runs correctly in this mode.

---

## apps/worker

**Runtime**: Cloudflare Workers (queue consumer).

Eight job types handled by `dispatch()` in `apps/worker/src/index.ts`:

| Job type | Status |
|---|---|
| `process-submission` | Stub |
| `send-notification` | Stub |
| `send-autoresponder` | Stub |
| `deliver-webhook` | Partial — HTTP call via `attemptDelivery()` works; all DB writes are TODO |
| `scan-file` | Stub |
| `run-health-check` | Stub |
| `enrich-analytics` | Stub |
| `sweep-retention` | Stub |

The `deliver-webhook` handler calls `attemptDelivery` from `@submitpulse/webhooks`, which calls `safeFetch()` through the SSRF guard in `packages/security/src/ssrf.ts`. All database operations (INSERT to `webhook_deliveries`, UPDATE `consecutive_failures`, auto-disable logic) are replaced with TODO comments.

---

## apps/web

**Framework**: Next.js 14 App Router.

**Auth**: Supabase Auth via `@submitpulse/auth`. The `setProvider()` call that initialises the singleton is missing from the codebase. `resolveMembership()` always returns null. No authenticated operation works.

**Data**: All dashboard data comes from hardcoded fixture functions in `apps/web/src/lib/dashboard-data.ts`. No Drizzle queries are wired to any route.

**Route groups**:

| Group | Prefix | Auth |
|---|---|---|
| `(marketing)` | `/`, `/pricing`, `/ai-builders`, `/docs`, `/status`, `/legal/*` | None |
| `(auth)` | `/login`, `/signup`, `/verify-email`, `/reset-password` | None |
| `(onboarding)` | `/onboarding` | Session required |
| `(dashboard)` | `/overview`, `/forms`, `/submissions`, `/pulse`, `/integrations`, `/team`, `/usage`, `/billing`, `/settings` | Session + workspace membership |
| `(admin)` | `/admin/**` | Session + `is_platform_admin` |

---

## apps/mcp

**Runtime**: Node.js (stdio transport). Intended for installation as a local MCP server by AI coding agents.

**Auth**: Installation token model — short-lived, scoped tokens issued during the setup flow. `verifyInstallationToken()` is INCOMPLETE.

**7 tools**: `list_forms`, `get_form_config`, `get_schema`, `generate_integration`, `validate_integration`, `send_test_submission`, `check_form_health`. Of these, `generate_integration` and `validate_integration` are fully functional.

---

## packages/database

Drizzle ORM schema targeting Supabase Postgres. One SQL migration file: `packages/database/migrations/0001_row_level_security.sql`.

**Tables**: 34 total across 5 schema modules:

| Module | Tables |
|---|---|
| `identity.ts` | `users`, `workspaces`, `workspace_members`, `invitations` |
| `forms.ts` | `forms`, `form_domains`, `form_endpoints`, `form_schema_versions`, `form_fields`, `email_destinations`, `autoresponders`, `spam_rules` |
| `submissions.ts` | `submissions`, `submission_events`, `submission_files`, `submission_tags`, `submission_notes`, `spam_decisions` |
| `delivery.ts` | `webhook_endpoints`, `webhook_deliveries`, `integrations` |
| `health.ts` | `health_monitors`, `health_runs`, `incidents`, `schema_drift_events` |
| `platform.ts` | `api_keys`, `installation_tokens`, `usage_events`, `subscriptions`, `audit_logs`, `security_events`, `feature_flags`, `background_jobs` |

**RLS model**: Three Postgres roles — `sp_anon` (unauthenticated), `sp_app` (application), `sp_service` (queue consumer; bypasses RLS for cross-tenant operations). Tenant context set via `SET LOCAL app.workspace_id = '...'` before each request. All workspace-scoped tables have `FORCE ROW LEVEL SECURITY` plus `SECURITY DEFINER` helper functions to avoid circular RLS on `workspace_members`.

**No `drizzle.config.ts` exists.** `drizzle-kit push` cannot run.

---

## Security architecture (three layers)

From `packages/auth/src/permissions.ts`:

1. **Permission matrix**: `can(actor, permission)` answers "what may this role do?"
2. **Tenant scoping**: all queries must filter by `workspace_id`. Not enforced automatically.
3. **Row Level Security**: database-level backstop. "A permission grant is never sufficient on its own; callers must still scope queries by workspace. RLS exists because this layer can be bypassed by a bug."

All three layers must be intact. None of the application-layer enforcement (layers 1 and 2) is wired to live queries in the current state.

---

## Monorepo tooling

| Tool | Purpose |
|---|---|
| pnpm 10.34.5 | Package manager and workspace orchestration |
| Turborepo | Build orchestration and caching (`turbo.json`) |
| TypeScript | Project references via `tsconfig.base.json` |
| Vitest | Unit and integration testing (unrun) |
| Playwright | E2E testing (unrun; 22 tests marked fixme) |
| k6 | Load testing (5 scripts exist; none have run) |
| Gitleaks | Secret scanning (in CI) |
| CodeQL | Static analysis (in `.github/workflows/codeql.yml`) |

**CI workflows**: `.github/workflows/ci.yml` defines 9 jobs (format, lint, typecheck, unit tests, integration tests, build, dependency audit, secret scan, migration validation). `.github/workflows/e2e.yml` defines the Playwright job. None have passed because the npm registry was firewalled.
