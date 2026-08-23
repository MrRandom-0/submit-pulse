# 30 — Deployment

> **Status**: No deployment has been performed. All infrastructure IDs in `wrangler.toml` are placeholders. No Cloudflare Workers, D1 database, KV namespace, or Queue exists. The web app has never been built.

---

## Target architecture

| Component | Platform | Status |
|---|---|---|
| `apps/ingest` | Cloudflare Workers | Placeholder bindings; not deployed |
| `apps/worker` | Cloudflare Workers (queue consumer) | Not deployed |
| `apps/web` | Vercel (or equivalent Next.js host) | Not deployed |
| `apps/mcp` | Distributed as npm package | Not published |
| Database | Supabase Postgres | Not provisioned |
| Auth | Supabase Auth | Not configured |
| Email | Resend | No API key |
| Billing | Stripe | No account |
| Rate limiting | Upstash Redis | No credentials |
| File storage | Cloudflare R2 | No bucket |
| CAPTCHA | Cloudflare Turnstile | No credentials |

---

## Steps to deploy (not verified — these instructions have never been executed)

### 1. Restore the build environment

```bash
# Requires npm registry access (currently firewalled)
pnpm install
pnpm typecheck   # resolve any TypeScript errors
pnpm lint        # resolve any ESLint errors
pnpm test        # confirm unit tests pass
```

### 2. Provision external services

- **Supabase**: create a project. Note project URL, anon key, service role key.
- **Resend**: create an account. Generate an API key. Configure SPF/DKIM/DMARC for the sending domain.
- **Stripe**: create an account. Create products and prices matching `entitlements.ts` exactly. Note the secret key and configure a webhook endpoint (`/api/stripe/webhook`).
- **Upstash Redis**: create a database. Note the REST URL and token.
- **Cloudflare Turnstile**: create a site key/secret for the form embedding origin.

### 3. Provision Cloudflare infrastructure

```bash
# Create D1 database
wrangler d1 create submitpulse-db

# Create KV namespace
wrangler kv namespace create IDEMPOTENCY_KV

# Create Queue
wrangler queues create submitpulse-submissions
```

Replace `REPLACE_WITH_D1_DATABASE_ID` and `REPLACE_WITH_KV_NAMESPACE_ID` in `apps/ingest/wrangler.toml` and `apps/worker/` config with the actual IDs output by the above commands.

### 4. Apply the database schema

```bash
# Apply the RLS migration to Supabase Postgres
psql "$SUPABASE_CONNECTION_STRING" \
  -f packages/database/migrations/0001_row_level_security.sql

# Create drizzle.config.ts (does not yet exist in the codebase)
# Then apply the Drizzle schema:
pnpm --filter @submitpulse/database drizzle-kit push
```

**`drizzle.config.ts` does not exist.** It must be created before `drizzle-kit push` can run.

### 5. Set Wrangler secrets

```bash
cd apps/ingest
wrangler secret put SP_TURNSTILE_SECRET_KEY
wrangler secret put SP_UPSTASH_REDIS_REST_URL
wrangler secret put SP_UPSTASH_REDIS_REST_TOKEN
```

Repeat for `apps/worker` with any secrets it needs.

### 6. Configure environment variables

Set all variables from `docs/38-environment-variables.md`:
- Vercel environment variables for `apps/web`.
- Wrangler secrets for `apps/ingest` and `apps/worker`.

### 7. Build

```bash
pnpm turbo run build
# This has never run; node_modules does not exist.
```

### 8. Deploy workers

```bash
cd apps/ingest
wrangler deploy --env production

cd apps/worker
wrangler deploy --env production
```

### 9. Deploy web app

```bash
cd apps/web
vercel deploy --prod
# Or use the Vercel Git integration for automatic deploys.
```

### 10. Verify

- `GET https://api.submitpulse.com/health` → `{"ok": true}`.
- Submit a test form → confirm 202 response with `x-submitpulse-request-id` header.
- Check Cloudflare Workers logs for pipeline stage completion messages.
- Verify the submission appears in the dashboard (requires auth to be wired).

---

## Production vs development driver selection

The `ENVIRONMENT` variable in `wrangler.toml` controls which drivers are used:

| Driver | `ENVIRONMENT=production` | `ENVIRONMENT=development` or absent |
|---|---|---|
| Form repository | `D1FormRepository` (SQL queries — INCOMPLETE) | `DevFormRepository` (fixture) |
| CAPTCHA verifier | `TurnstileVerifier` | `DevBypassCaptchaVerifier` (always passes) |
| Rate limiter | `UpstashRateLimiter` (cross-instance) | `InMemoryRateLimiter` (process-local) |

**Never use development drivers in production.** The dev drivers accept all submissions without checking real configuration.

---

## CI gate (not yet active)

The CI workflow in `.github/workflows/ci.yml` defines branch protection requirements. Branch protection must be enabled manually in GitHub repository settings (Settings → Branches → Add rule). Required status checks:

- format-check
- lint
- typecheck
- unit-tests
- integration-tests
- build
- dependency-audit
- secret-scan
- codeql
- migration-validation

None of these checks have passed.
