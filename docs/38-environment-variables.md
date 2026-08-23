# 38 — Environment Variables

All Submit Pulse environment variables are named using the `SP_` prefix (from `brand.env.prefix`). Client-side (browser-exposed) variables additionally carry the Next.js `NEXT_PUBLIC_` prefix.

The `brand.env.var(name)` helper produces `SP_<name>`. The `brand.env.publicVar(name)` helper produces `NEXT_PUBLIC_SP_<name>`.

## Required variables

### Authentication (Supabase)

Source: `packages/auth/src/supabase-provider.ts`

| Variable | Required | Secret | Description |
|---|:---:|:---:|---|
| `SP_SUPABASE_URL` | Yes | No | Supabase project URL (e.g. `https://xxxx.supabase.co`). Used server-side. |
| `SP_SUPABASE_ANON_KEY` | Yes | No | Supabase anonymous key. Used server-side and client-side. |
| `SP_SUPABASE_SERVICE_KEY` | Yes | Yes | Supabase service role key. Used server-side for admin operations (signOutEverywhere). Never expose to the browser. |
| `NEXT_PUBLIC_SP_SUPABASE_URL` | Yes | No | Same as `SP_SUPABASE_URL` but exposed to the browser via Next.js. |
| `NEXT_PUBLIC_SP_SUPABASE_ANON_KEY` | Yes | No | Same as `SP_SUPABASE_ANON_KEY` but exposed to the browser. |

### Email (Resend)

Source: `packages/email/src/resend-provider.ts`

| Variable | Required | Secret | Description |
|---|:---:|:---:|---|
| `SP_RESEND_API_KEY` | Yes (production) | Yes | Resend API key for transactional email. If absent, the dev fallback is `console-provider.ts` which logs emails to stdout. |

### CAPTCHA (Cloudflare Turnstile)

Source: `packages/security/src/captcha.ts`, `apps/ingest/wrangler.toml`

| Variable | Required | Secret | Description |
|---|:---:|:---:|---|
| `SP_TURNSTILE_SECRET_KEY` | Yes (production) | Yes | Cloudflare Turnstile secret key for server-side token verification. Set via `wrangler secret put`. |
| `NEXT_PUBLIC_SP_TURNSTILE_SITE_KEY` | Yes (when CAPTCHA is enabled) | No | Cloudflare Turnstile site key for the client-side widget. |

### Rate limiting (Upstash Redis)

Source: `apps/ingest/src/index.ts`, `apps/ingest/wrangler.toml`

| Variable | Required | Secret | Description |
|---|:---:|:---:|---|
| `SP_UPSTASH_REDIS_REST_URL` | Yes (production) | No | Upstash Redis REST URL. Without this, `InMemoryRateLimiter` is used (no shared state). |
| `SP_UPSTASH_REDIS_REST_TOKEN` | Yes (production) | Yes | Upstash Redis REST token. Set via `wrangler secret put`. |

### Billing (Stripe)

Source: `packages/database/src/schema/platform.ts` (schema references); billing integration not implemented.

| Variable | Required | Secret | Description |
|---|:---:|:---:|---|
| `SP_STRIPE_SECRET_KEY` | Yes (production) | Yes | Stripe secret key for server-side API calls. |
| `SP_STRIPE_WEBHOOK_SECRET` | Yes (production) | Yes | Stripe webhook signing secret for verifying incoming Stripe events. |
| `NEXT_PUBLIC_SP_STRIPE_PUBLISHABLE_KEY` | Yes (production) | No | Stripe publishable key for client-side Stripe.js. |

### Cloudflare Workers bindings

Set via `wrangler.toml` (not environment variables in the traditional sense):

| Binding | Type | Notes |
|---|---|---|
| `DB` | D1 database | `database_id` is a placeholder. |
| `IDEMPOTENCY_KV` | KV namespace | `id` is a placeholder. |
| `SUBMISSION_QUEUE` | Queue producer | `queue` name is a placeholder. |

These are Cloudflare-specific bindings, not `process.env` variables. They are available as `c.env.DB`, `c.env.IDEMPOTENCY_KV`, `c.env.SUBMISSION_QUEUE` in the Workers environment.

### Runtime mode

| Variable | Required | Secret | Description |
|---|:---:|:---:|---|
| `ENVIRONMENT` | No | No | Set to `production` to enable production drivers (Turnstile, D1 repository). Any other value or absent uses dev bypass drivers. Set in `wrangler.toml` `[vars]`. |
| `NODE_ENV` | No | No | Standard Node.js environment. `production` enables extra guards (prevents dev bypass drivers from running). Used in `packages/auth/src/dev-provider.ts` and `packages/email/src/console-provider.ts`. |

## Variable naming convention

The `brand.env.var()` function centralises naming. If the product is renamed, only `BRAND_SEED.envPrefix` in `packages/config/src/brand.ts` changes; all variable names update automatically.

Variables currently computed:
- `brand.env.var("RESEND_API_KEY")` → `SP_RESEND_API_KEY`
- `brand.env.var("SUPABASE_URL")` → `SP_SUPABASE_URL`
- `brand.env.var("SUPABASE_ANON_KEY")` → `SP_SUPABASE_ANON_KEY`
- `brand.env.var("SUPABASE_SERVICE_KEY")` → `SP_SUPABASE_SERVICE_KEY`
- `brand.env.var("TURNSTILE_SECRET_KEY")` → `SP_TURNSTILE_SECRET_KEY`
- `brand.env.var("UPSTASH_REDIS_REST_URL")` → `SP_UPSTASH_REDIS_REST_URL`
- `brand.env.var("UPSTASH_REDIS_REST_TOKEN")` → `SP_UPSTASH_REDIS_REST_TOKEN`

The `wrangler.toml` uses the raw names (`SP_TURNSTILE_SECRET_KEY`, etc.) as secret names.

## Minimum set for local development

For local development without external services:

```
# Not required — dev bypass drivers are active when ENVIRONMENT is not "production"
# Submit test submissions at http://localhost:8787
```

The dev form repository returns a fixture form for any `fm_xxx` ID. The dev captcha verifier accepts any token. The in-memory rate limiter allows all requests. The console email provider logs to stdout.

No variables are required for the basic local development flow.
