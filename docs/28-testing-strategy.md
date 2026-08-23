# 28 — Testing Strategy

> **Status**: Zero tests have ever run. The npm registry was firewalled during development. No test runner has access to its dependencies. Test files and CI workflows exist as authored intent only.

---

## What exists

### Unit tests (Vitest)

`apps/ingest/src/__tests__/`:
- `origin.test.ts` — `evaluateRequestOrigin()` tests
- `ssrf.test.ts` — `assertSafeEgressUrl()` tests
- `idempotency.test.ts` — idempotency key dedup logic tests
- `payload-size.test.ts` — `readBodyWithSizeGuard()` tests
- `validation.test.ts` — `parseBody()` and `runSchemaValidation()` tests

`packages/config/src/__tests__/`:
- `integration-prompts.test.ts` — `generateIntegrationPrompt()` tests

Vitest configuration: `apps/ingest/vitest.config.ts`.

### E2E tests (Playwright)

`apps/web/e2e/`:
- `auth.setup.ts` — shared auth setup
- `signup.spec.ts`
- `workspace.spec.ts`
- `form-lifecycle.spec.ts`
- `delivery.spec.ts`
- `file-upload.spec.ts`
- `spam-protection.spec.ts`
- `pulse-monitor.spec.ts`
- `billing.spec.ts`
- `export-delete.spec.ts`

**22 tests are marked `test.fixme()`** — they define intended behaviour but cannot run until the full stack is deployed. Every test that requires a real backend is marked fixme.

### Load tests (k6)

`load-tests/`:
- `submission-sustained.js` — baseline ingestion throughput (target: p95 < 300 ms at 1,000 req/min sustained)
- `submission-burst.js` — spike profile
- `abusive-ip.js` — rate limit assertion (target: ≥90% 429 responses after limit exhausted)
- `many-forms.js` — traffic spread across many form IDs
- `large-rejected.js` — 413 fast rejection (target: p95 < 100 ms)

**None have ever been executed. Zero benchmark results exist.**

### CI workflows

`.github/workflows/ci.yml` defines 9 jobs run on push to main and on pull requests:

| Job | Command |
|---|---|
| format-check | `pnpm format:check` |
| lint | `pnpm turbo run lint` |
| typecheck | `pnpm typecheck` |
| unit-tests | `pnpm turbo run test --filter='!./apps/web'` |
| integration-tests | `pnpm turbo run test:integration` |
| build | `pnpm build` |
| dependency-audit | `pnpm audit --audit-level high` |
| secret-scan | Gitleaks via `gitleaks/gitleaks-action@v2` |
| migration-validation | `pnpm db:generate` (dry-run schema check) |

`.github/workflows/e2e.yml` runs Playwright with browser caching.

`.github/workflows/codeql.yml` runs CodeQL static analysis.

**None of these jobs have ever passed** because every job begins with `pnpm install --frozen-lockfile`, which requires npm registry access.

---

## Intended test strategy

### Unit tests — target: pure functions and pipeline stages

Priority areas:

| Area | What to test |
|---|---|
| SSRF guard (`packages/security/src/ssrf.ts`) | All blocked ranges (127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 169.254/16, fc00::/7, fe80::/10, ::1, metadata endpoints). Redirect re-validation. Blocked ports. Invalid URLs. |
| Origin evaluation (`packages/security/src/origin.ts`) | Exact match, subdomain match, localhost allow/deny, scheme normalisation. |
| File validation (`packages/security/src/file-validation.ts`) | Magic-byte detection, double-extension rejection, blocked extension list, MIME family comparison, storage key format. |
| Spam rules | Honeypot trigger, score accumulation, allowlist negative weights. |
| Entitlement engine (`packages/config/src/entitlements.ts`) | Each quota dimension at and above limit, feature flags per plan. |
| Webhook signing (`packages/webhooks/src/signing.ts`) | Signature correctness, replay window enforcement, constant-time comparison. |
| Integration prompts (`packages/config/src/integration-prompts.ts`) | No credential fields in output, builder-specific caveats present, visual editor instructions for Framer/Webflow. |
| Analytics aggregates (`packages/analytics/src/index.ts`) | Synthetic exclusion from every aggregate function. |

### Integration tests — target: pipeline end-to-end with dev repository

Key scenarios:

- Submit a valid form → 202 Accepted.
- Submit with honeypot populated → 400 SUBMISSION_BLOCKED.
- Submit with oversized body → 413 PAYLOAD_TOO_LARGE.
- Submit to a paused form → 404 FORM_NOT_FOUND.
- Submit from a disallowed origin → 403 ORIGIN_REJECTED.
- Submit same idempotency key twice → same publicId returned.
- Submit with valid CAPTCHA bypass token → 202.
- Submit with missing required field → 422 VALIDATION_ERROR with field detail.
- Submit a file with blocked extension → 400.

### E2E tests — target: full dashboard user flows

22 tests are currently `test.fixme()`. Key intended flows:

- Sign up → verify email → onboarding wizard → form created.
- Form created → integration prompt displayed → snippet copy.
- Submit via browser → submission appears in inbox.
- Mark submission as spam → disappears from main inbox.
- Restore spam submission → returns to inbox.
- Configure webhook → submit → delivery appears in webhook log.
- Schema drift detected → repair prompt generated → user copies prompt.

### Load tests — target: ingestion performance

See `docs/29-load-testing.md`. No results exist.

---

## Prerequisites before any test result is valid

1. `pnpm install` completes (requires npm registry access).
2. TypeScript compiles without errors (`pnpm typecheck`).
3. Dev form repository and dev captcha bypass confirmed working.
4. For integration tests: Hono worker startable via `wrangler dev`.
5. For E2E tests: full stack running with a test database.
6. For load tests: Cloudflare Workers deployed with real bindings and Upstash Redis (cross-instance rate limiting).

None of these conditions exist.
