# 32 — Incident Response

## Status

No incident response runbooks have been tested. No on-call rotation exists. No alerting is configured. This document describes the intended process.

## Severity definitions

| Severity | Criteria | Example |
|---|---|---|
| Critical | Platform-wide ingestion failure; all submissions rejected. | Cloudflare Workers deployment failure; D1 database unreachable. |
| High | Significant data loss risk; auth failure; security breach. | RLS policy misconfiguration; credentials exposed. |
| Medium | Feature degraded; subset of users affected. | Webhook delivery failing; email notifications not sending. |
| Low | Minor UI bugs; non-critical feature unavailable. | Dashboard fixture data mismatch; onboarding wizard UX issue. |

## Detection

Currently: no automated detection. Incidents would be reported by customers or discovered during manual testing.

Intended detection sources:
- Cloudflare Workers error rate alerts.
- Pulse Monitor self-check (the platform monitoring its own ingestion endpoint).
- `security_events` anomaly detection.
- Stripe webhook failures.

## Response steps

### Critical: Ingestion failure

1. Identify scope: which forms are affected? All forms or a subset?
2. Check Cloudflare Workers dashboard for error logs.
3. Check D1 database availability.
4. If a deployment caused the failure: roll back via `wrangler rollback`.
5. If a database issue: check Supabase status page; engage Supabase support.
6. Communicate status to customers via `status.submitpulse.com`.
7. Post incident report within 48 hours.

### High: Security breach

1. Immediately rotate all platform secrets (`SP_SUPABASE_SERVICE_ROLE_KEY`, `SP_STRIPE_SECRET_KEY`, `SP_RESEND_API_KEY`, `SP_TURNSTILE_SECRET_KEY`, `SP_UPSTASH_REDIS_REST_TOKEN`).
2. Revoke all active API keys and installation tokens (via database update or Supabase Auth session invalidation).
3. Assess which tenant data may have been accessed.
4. Notify affected tenants within the legally required timeframe.
5. Engage `security@submitpulse.com` (email address defined in brand module).
6. If a data breach: follow applicable breach notification requirements.

### Medium: Delivery failure (email or webhooks)

1. Check the email provider (Resend) status page.
2. Check `email_deliveries` table for error details.
3. Check `webhook_deliveries` table for failure patterns.
4. If provider-side: wait for recovery; retry failed deliveries.
5. If code-side: identify the failing handler; deploy a fix.

## Rollback

Cloudflare Workers: `wrangler rollback` to the previous deployment version.

Next.js web app: redeploy the previous build via the hosting provider.

Database schema changes: schema changes are migrations. Rollback requires writing a down-migration. None exist; plan migrations carefully before applying.

## Post-incident review

After any Critical or High incident, a post-incident review should be written covering:
- Timeline of events.
- Root cause.
- What worked in the response.
- What did not work.
- Action items to prevent recurrence.

No post-incident reviews exist because no incidents have occurred (the system is not running).

## Contact

- Security: `security@submitpulse.com`
- Abuse: `abuse@submitpulse.com`
- Support: `support@submitpulse.com`

Email addresses are derived from `packages/config/src/brand.ts`; they are brand constants. No email infrastructure is configured to receive or route these addresses.
