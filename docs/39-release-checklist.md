# 39 — Release Checklist

This checklist documents every task required before Submit Pulse can be considered releasable. It is not a routine "pre-release" checklist; it is a gap analysis against a codebase that has never been built, tested, or deployed.

---

## 1. Build environment

- [ ] Obtain npm registry access (unblock the firewall).
- [ ] Run `pnpm install` to completion.
- [ ] Run `pnpm typecheck` across all packages — resolve all TypeScript errors.
- [ ] Run `pnpm lint` — resolve all ESLint violations.
- [ ] Run `pnpm format:check` — resolve all formatting issues.
- [ ] Run `pnpm test` — confirm all unit tests pass.
- [ ] Run `pnpm build` — confirm all packages build without errors.

---

## 2. Database

- [ ] Provision a Supabase Postgres project (Pro plan minimum for PITR).
- [ ] Apply `packages/database/migrations/0001_row_level_security.sql` to the project.
- [ ] Create `packages/database/drizzle.config.ts` with the connection string.
- [ ] Run `drizzle-kit push` to apply the Drizzle schema.
- [ ] Verify RLS is active: query as `sp_app` without `app.workspace_id` set; confirm zero rows returned from any workspace-scoped table.
- [ ] Verify agency RLS: confirm an agency member can see client workspaces but not unrelated ones.
- [ ] Verify partial unique index on `integrations`: confirm two workspace-level rows for the same provider are rejected.
- [ ] Verify `FORCE ROW LEVEL SECURITY` on all tenant tables.
- [ ] Confirm `sp_service` role is NOT accessible via the application connection pool.

---

## 3. Ingestion service (`apps/ingest`)

- [ ] Implement `D1FormRepository.lookupForm()` SQL query.
- [ ] Implement `D1FormRepository.createSubmission()`.
- [ ] Implement `D1FormRepository.getSpamRules()`.
- [ ] Provision Cloudflare D1 database. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml`.
- [ ] Provision Cloudflare KV namespace. Replace `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.toml`.
- [ ] Create Cloudflare Queue. Update `wrangler.toml`.
- [ ] Set `SP_TURNSTILE_SECRET_KEY` via `wrangler secret put`.
- [ ] Set `SP_UPSTASH_REDIS_REST_URL` and `SP_UPSTASH_REDIS_REST_TOKEN`. Swap `InMemoryRateLimiter` for `UpstashRateLimiter`.
- [ ] Deploy to Cloudflare Workers (`wrangler deploy --env production`).
- [ ] Verify `GET /health` returns 200.
- [ ] Verify a test submission returns 202 with `x-submitpulse-request-id` header.
- [ ] Run integration test suite against the deployed worker.

---

## 4. Worker service (`apps/worker`)

- [ ] Implement `handleProcessSubmission` (spam scoring, schema drift detection, analytics writes).
- [ ] Implement `handleSendNotification` (email destination delivery via Resend).
- [ ] Implement `handleSendAutoresponder`.
- [ ] Complete `handleDeliverWebhook` database writes (INSERT `webhook_deliveries`, UPDATE `consecutive_failures`, auto-disable logic).
- [ ] Implement `handleScanFile` (antivirus provider integration — provider to be selected).
- [ ] Implement `handleRunHealthCheck` (headless browser execution — provider to be selected).
- [ ] Implement `handleEnrichAnalytics` (counter and UTM aggregate writes to `usage_events`).
- [ ] Implement `handleSweepRetention` (purge submissions past `retention_days`; coordinate R2 object deletion).
- [ ] Deploy worker queue consumer.
- [ ] Verify end-to-end: submit → notification email received → webhook delivered → analytics updated.

---

## 5. Web app (`apps/web`)

- [ ] Wire `setProvider()` in `apps/web/src/instrumentation.ts` with the Supabase provider and real credentials.
- [ ] Implement `resolveMembership()` in `packages/auth/src/session.ts` with a real Drizzle query against `workspace_members`.
- [ ] Replace all `dashboard-data.ts` fixture functions with real Drizzle queries.
- [ ] Replace all `admin-data.ts` fixture functions with real queries.
- [ ] Wire `requireActor()` checks in all Server Actions and Route Handlers.
- [ ] Implement email destination verification flow.
- [ ] Implement workspace invitation acceptance flow.
- [ ] Implement API key creation/revocation UI and server actions.
- [ ] Implement Stripe checkout and subscription management.
- [ ] Deploy to Vercel (or equivalent).

---

## 6. Security

- [ ] Implement envelope encryption for `integrations.credentials` in `packages/security/`.
- [ ] Implement Stripe webhook signature verification (`Stripe-Signature` header) before any payload is trusted.
- [ ] Confirm antivirus scanning is functional before enabling file uploads in production.
- [ ] Resolve the SSRF DNS rebinding vulnerability in `packages/security/src/ssrf.ts` (document and mitigate).
- [ ] Confirm `sp_service` database role cannot be used from user-facing connection pools.
- [ ] Run a qualified security review of all three security layers (permission matrix, tenant scoping, RLS).

---

## 7. Testing gates

- [ ] Vitest unit tests: all pass.
- [ ] Vitest integration tests: all pass against the deployed ingestion worker.
- [ ] Playwright E2E tests: all 22 `test.fixme()` tests unmarked and passing.
- [ ] k6 load tests: baseline run completed; results recorded in `docs/29-load-testing.md`.
- [ ] Pulse Monitor self-check: the platform monitors its own ingestion endpoint.

---

## 8. CI gate

- [ ] Enable branch protection in GitHub repository settings.
- [ ] Required status checks: format-check, lint, typecheck, unit-tests, integration-tests, build, dependency-audit, secret-scan, codeql, migration-validation.
- [ ] Confirm all status checks pass on the main branch.

---

## 9. Admin and operations

- [ ] Set `users.is_platform_admin = true` for at least one staff member.
- [ ] Wire `/admin/**` routes to live database queries.
- [ ] Test incident creation → status page update → alert email delivery.
- [ ] Test dead-letter job retry from `/admin/jobs`.
- [ ] Test feature flag toggle from `/admin/feature-flags`.

---

## 10. Before commercial launch

- [ ] Legal review of `/privacy`, `/terms`, `/legal/acceptable-use`, `/legal/dpa`, `/legal/subprocessors`, `/legal/security-practices`.
- [ ] Create Stripe products and prices in production Stripe account.
- [ ] Configure SPF, DKIM, and DMARC for the Resend sending domain.
- [ ] Set up the `/status` page at `status.submitpulse.com` with the real incidents table.
- [ ] Configure alerting: Cloudflare error rate alerts, Sentry (or equivalent).
- [ ] Establish on-call rotation and incident response process.
- [ ] Conduct a final security review with a qualified third party.
- [ ] Remove all "DEVELOPMENT FIXTURES" banners from admin UI.
- [ ] Confirm no hardcoded brand literals leaked (run `pnpm brand:verify`).
