# 24 — Billing

Sources: `packages/config/src/entitlements.ts`, `packages/database/src/schema/platform.ts`.

---

## Overview

Billing is defined at the entitlement-logic and schema levels. No Stripe integration code exists. The `packages/billing/` directory is an empty package placeholder — no source files are present.

---

## Plans

All prices are code constants in `packages/config/src/entitlements.ts`. No Stripe products have been created.

| Plan | Monthly | Annual | Forms | Submissions/month | Members | History | File storage | Health tests/month | AI analyses/month |
|---|---|---|---|---|---|---|---|---|---|
| Free | $0 | $0 | 2 | 100 | 1 | 7 days | 0 | 0 | 0 |
| Starter | $9 | $90 | 10 | 1,000 | 3 | 30 days | 0 | 0 | 0 |
| Pro | $29 | $290 | 50 | 10,000 | 10 | 365 days | 25 GB | 20,000 | 500 |
| Agency | $79 | $790 | 250 | 50,000 | 25 | 730 days | 150 GB | 100,000 | 2,500 |

Annual pricing: 10× the monthly price (two months free).

## Feature access by plan

| Feature | Free | Starter | Pro | Agency |
|---|:---:|:---:|:---:|:---:|
| Autoresponders | No | Yes | Yes | Yes |
| Webhooks | No | Yes | Yes | Yes |
| Domain rules | No | Yes | Yes | Yes |
| File uploads | No | No | Yes | Yes |
| Advanced spam | No | No | Yes | Yes |
| Pulse Monitor | No | No | Yes | Yes |
| Schema drift | No | No | Yes | Yes |
| AI repair | No | No | Yes | Yes |
| Integrations | No | No | Yes | Yes |
| Analytics | No | No | Yes | Yes |
| MCP server | No | No | Yes | Yes |
| Client workspaces | No | No | No | Yes |
| Agency dashboard | No | No | No | Yes |
| White-label reports | No | No | No | Yes |
| Priority support | No | No | No | Yes |

---

## Entitlement engine

`packages/config/src/entitlements.ts` exports the following functions. They are pure — no database access.

### `canUseFeature(ctx, feature): FeatureVerdict`

```typescript
const verdict = canUseFeature({ plan: "starter", usage: {} }, "pulseMonitor");
// { allowed: false, reason: "feature_not_in_plan", upgradeTo: "pro" }
```

### `checkQuota(ctx, quota, amount = 1): QuotaVerdict`

```typescript
const verdict = checkQuota(
  { plan: "free", usage: { submissionsPerMonth: 95 } },
  "submissionsPerMonth",
  10,
);
// { allowed: false, reason: "quota_exceeded", limit: 100, current: 95, upgradeTo: "starter" }
```

### `lowestPlanWithFeature(feature): PlanId | null`

Returns the cheapest plan that includes a feature. Returns null if no plan includes it.

### `lowestPlanWithQuota(quota, needed): PlanId | null`

Returns the cheapest plan whose quota can accommodate `needed`.

### `retentionDays(plan): number | null`

Submission history retention limit. Returns null for Unlimited (no plan currently has unlimited retention).

### `formatQuota(limit): string`

Returns `"Unlimited"` for null; localised number string otherwise.

---

## Subscriptions table

`subscriptions` in `packages/database/src/schema/platform.ts`. One row per workspace.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | uuid UNIQUE | One subscription per workspace |
| `plan` | enum | `free \| starter \| pro \| agency` |
| `status` | enum | `active \| past_due \| canceled \| trialing \| paused` |
| `stripe_customer_id` | text | Stripe customer ID |
| `stripe_subscription_id` | text UNIQUE | Stripe subscription ID |
| `stripe_price_id` | text | Active price ID |
| `current_period_start` / `_end` | timestamp | Billing period |
| `cancel_at_period_end` | boolean | Scheduled cancellation |
| `billing_interval` | text | `month` or `year` (CHECK constraint) |
| `seats` | integer | `>= 1` (CHECK constraint) |

**Stripe webhooks are the authoritative source of truth.** Application code must not trust plan status from its own database without verifying it against Stripe first. All webhook writes must verify `Stripe-Signature`. Signature verification is not implemented.

---

## Usage events (metering ledger)

`usage_events` records one row per billable event. Fields:

| Column | Notes |
|---|---|
| `workspace_id` | Required |
| `form_id` | Nullable; null for workspace-level events |
| `metric` | One of: `submission_accepted`, `form_created`, `health_test`, `ai_analysis`, `storage_bytes`, `file_bandwidth_bytes`, `email_delivered`, `webhook_attempt`, `member_added` |
| `quantity` | Positive integer (CHECK constraint) |
| `idempotency_key` | UNIQUE — prevents double-billing on retry |
| `billing_period_start` | Date for period attribution |

**Synthetic submissions must not emit `submission_accepted`**. The worker is responsible for checking `origin = 'synthetic'` before writing a usage event. The worker is currently a stub.

---

## Access control

| Permission | Who has it | Required for |
|---|---|---|
| `billing:read` | Owner, Admin | View billing page, subscription status |
| `billing:manage` | Owner only | Change plan, update payment method |
| `usage:read` | All roles | View usage metrics |

---

## What needs to be built

1. Implement `packages/billing/` source module.
2. Create Stripe products and prices matching the plan definitions.
3. Implement Stripe checkout flow in `apps/web` (plan selection → Stripe hosted checkout → success redirect).
4. Implement Stripe webhook handler (`/api/stripe/webhook`) for subscription lifecycle events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
5. Wire `Stripe-Signature` verification before any webhook payload is trusted.
6. Wire `billing:read` and `billing:manage` checks to the billing page server actions.
7. Wire usage event emission from worker handlers after each billable action.
8. Implement quota enforcement at form creation, submission acceptance, and member invitation.
