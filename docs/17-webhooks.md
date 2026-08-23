# 17 — Webhooks

Source: `packages/webhooks/src/`

## Overview

Webhooks deliver real-time event notifications to customer-configured HTTPS endpoints. The signing scheme, retry logic, and delivery record are fully defined; the database-write portions of the delivery handler are stubs.

## Event types

Defined in `packages/webhooks/src/events.ts`:

| Event | Trigger |
|---|---|
| `submission.created` | A new submission is accepted (non-spam, non-synthetic) |
| `submission.updated` | A submission's status, tags, or assignment changes |
| `submission.spam` | A submission is classified as spam or blocked |
| `submission.restored` | A spam submission is restored to clean |
| `form.health.failed` | A Pulse Monitor run fails |
| `form.schema.changed` | Schema drift is detected |

## Payload envelope

All payloads share this structure (version `v1`):

```json
{
  "version": "v1",
  "event": "submission.created",
  "createdAt": "2025-01-01T12:00:00.000Z",
  "workspaceId": "<uuid>",
  "formId": "<uuid>",
  "data": { ... }
}
```

The `version` field allows consumers to detect breaking changes. Increment is required before deploying a shape change.

## Signing

Source: `packages/webhooks/src/signing.ts`

Algorithm: HMAC-SHA256.

Signing payload: `<unix-timestamp>.<raw-body-bytes>` (timestamp prepended to prevent replay attacks).

Three headers are added to every outbound webhook:

| Header | Format |
|---|---|
| `x-submitpulse-signature` | `sha256=<hex-digest>` |
| `x-submitpulse-timestamp` | Unix seconds as string |
| `x-submitpulse-delivery-id` | UUID identifying this delivery attempt |

### Replay protection

The replay window is 300 seconds (5 minutes). The `verifyWebhook()` helper enforces this:

```typescript
if (Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
  return { valid: false, reason: `Timestamp ${ts} is outside the 300s replay window` };
}
```

### Timing-safe comparison

`verifyWebhook()` uses `timingSafeEqual` from `node:crypto` to compare HMAC digests. A naive string comparison would leak information about the number of matching prefix bytes.

### Secret storage

The HMAC signing secret is shown to the customer exactly once at endpoint creation. Only a bcrypt/argon2 hash (`webhook_endpoints.secret_hash`) is stored. The plaintext secret must be obtained from a secrets store by the delivery worker — it must NOT be read from the database.

## Retry schedule

Source: `packages/webhooks/src/retry.ts`

The retry schedule uses exponential backoff. Exact parameters require reading the source; the delivery worker calls `computeBackoff(attemptsSoFar + 1)` and checks `backoff.exhausted` to determine whether to retry or dead-letter.

## Auto-disable

`webhook_endpoints.consecutive_failures` is incremented on each failed delivery and reset to 0 on success. When `shouldAutoDisable(consecutiveFailures)` returns true (threshold defined in `retry.ts`), the endpoint's `disabled_at` is set. The worker logs a warning before setting this.

Users must re-enable the endpoint manually after fixing their server.

## Delivery record

Every delivery attempt is written to `webhook_deliveries`:
- UNIQUE on `delivery_id`: insert with ON CONFLICT DO NOTHING prevents duplicates on retry.
- `response_body_snippet` is capped before storage to prevent unbounded growth from a malicious endpoint sending large responses.
- `response_status`, `duration_ms`, `error` are recorded per attempt.

**Note**: The database writes in `apps/worker/src/handlers/deliver-webhook.ts` are TODO stubs. The HTTP call itself (`attemptDelivery`) is implemented; the surrounding DB operations are not.

## SSRF protection

Webhook endpoint URLs are validated through the shared SSRF egress guard at delivery time. See `docs/25-security-threat-model.md` for the DNS rebinding caveat.

The CHECK constraint on `webhook_endpoints.url` only enforces `https://` scheme. Private-range blocking happens at request time in `packages/security/src/ssrf.ts`.

## Replay

Users with `webhook:replay` permission can manually re-trigger delivery of a past event. This creates a new `webhook_deliveries` row with a new `delivery_id` (it is a new delivery attempt, not a replay of the original). The implementation is not present in any handler.

## Event subscription

`webhook_endpoints.events` is a jsonb string array of event names. Null or empty means subscribe to all events. The worker must check this before enqueuing delivery.
