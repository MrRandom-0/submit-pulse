# 37 — Webhook Reference

> **Source files:** `packages/webhooks/src/events.ts`,
> `packages/webhooks/src/signing.ts`, `packages/config/src/brand.ts`

---

## Overview

Submit Pulse sends signed HTTP POST requests to customer-registered HTTPS
endpoints when specific events occur. Delivery is asynchronous — webhooks fire
from the queue consumer after the 202 ingestion response has already been
returned to the submitter.

Webhook endpoint registration is managed through the dashboard. The management
REST API for registering endpoints is **not yet implemented**.

---

## Delivery format

### Method and headers

```
POST <your-endpoint-url>
Content-Type: application/json
User-Agent: SubmitPulse/1.0 (+https://submitpulse.com/bot)
x-submitpulse-signature:   sha256=<hex>
x-submitpulse-timestamp:   <unix-seconds>
x-submitpulse-delivery-id: <uuid>
```

Header names are derived from `packages/config/src/brand.ts` (`brand.wire.*`).

| Header | Format | Purpose |
|--------|--------|---------|
| `x-submitpulse-signature` | `sha256=<hex>` | HMAC-SHA256 of the payload (see signing below) |
| `x-submitpulse-timestamp` | Unix seconds as a string | Used for replay-window verification |
| `x-submitpulse-delivery-id` | UUID | Unique per delivery attempt; retries get a new ID |

### Payload envelope

Every event uses this shared structure:

```json
{
  "version": "v1",
  "event": "<event-type>",
  "createdAt": "2025-06-01T12:00:00.000Z",
  "workspaceId": "<uuid>",
  "formId": "<uuid>",
  "data": { ... }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `version` | `"v1"` | Payload schema version. Incremented on breaking changes. |
| `event` | string | One of the six event types listed below. |
| `createdAt` | ISO 8601 | When the event was emitted. |
| `workspaceId` | UUID | The workspace that owns the resource. |
| `formId` | UUID | The form the event relates to. |
| `data` | object | Event-specific payload (documented per event below). |

---

## Events

### `submission.created`

Fired when a new, non-spam submission is accepted and processed.

```json
{
  "version": "v1",
  "event": "submission.created",
  "createdAt": "2025-06-01T12:00:00.000Z",
  "workspaceId": "ws-uuid",
  "formId": "form-uuid",
  "data": {
    "submissionId": "sub-internal-uuid",
    "publicId": "sub_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    "origin": "live",
    "spamVerdict": "clean",
    "fields": {
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "message": "Hello"
    },
    "submittedAt": "2025-06-01T12:00:00.000Z"
  }
}
```

`data` fields:

| Field | Type | Notes |
|-------|------|-------|
| `submissionId` | string | Internal UUID |
| `publicId` | string | Public ID (`sub_<hex>`) from the 202 response |
| `origin` | `"live"` \| `"synthetic"` | Synthetic submissions are from Pulse Monitor health checks |
| `spamVerdict` | string | `"clean"`, `"suspect"`, `"spam"`, or `"blocked"` |
| `fields` | object | Validated field values |
| `submittedAt` | ISO 8601 | |

---

### `submission.updated`

Fired when a submission's status, tags, assignment, or notes are changed in
the dashboard.

```json
{
  "version": "v1",
  "event": "submission.updated",
  "createdAt": "2025-06-01T12:05:00.000Z",
  "workspaceId": "ws-uuid",
  "formId": "form-uuid",
  "data": {
    "submissionId": "sub-internal-uuid",
    "publicId": "sub_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    "changes": {
      "status": "qualified"
    },
    "updatedAt": "2025-06-01T12:05:00.000Z"
  }
}
```

`data.changes` contains only the fields that changed and their new values.

---

### `submission.spam`

Fired by the queue consumer after AI-based spam analysis classifies a
submission as spam or blocked.

```json
{
  "version": "v1",
  "event": "submission.spam",
  "createdAt": "2025-06-01T12:00:30.000Z",
  "workspaceId": "ws-uuid",
  "formId": "form-uuid",
  "data": {
    "submissionId": "sub-internal-uuid",
    "publicId": "sub_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    "spamVerdict": "spam",
    "spamScore": 0.92,
    "signals": [
      {
        "code": "keyword_match",
        "label": "Keyword blocklist match",
        "weight": 0.8,
        "evidence": "Field 'message' contains blocked term"
      }
    ],
    "detectedAt": "2025-06-01T12:00:30.000Z"
  }
}
```

`data` fields:

| Field | Type | Notes |
|-------|------|-------|
| `spamVerdict` | `"spam"` \| `"blocked"` | Only spam verdicts fire this event |
| `spamScore` | float 0–1 | Higher is more likely spam |
| `signals` | array | Individual signals that contributed to the verdict |
| `signals[].code` | string | Machine-readable signal identifier |
| `signals[].weight` | float | This signal's contribution to the score |
| `signals[].evidence` | string | Optional: human-readable evidence string |

---

### `submission.restored`

Fired when a workspace member manually restores a spam-classified submission
to clean status.

```json
{
  "version": "v1",
  "event": "submission.restored",
  "createdAt": "2025-06-01T14:00:00.000Z",
  "workspaceId": "ws-uuid",
  "formId": "form-uuid",
  "data": {
    "submissionId": "sub-internal-uuid",
    "publicId": "sub_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    "restoredBy": "user",
    "restoredAt": "2025-06-01T14:00:00.000Z"
  }
}
```

`data.restoredBy` is `"user"` (manual action) or `"system"` (automated
reclassification).

---

### `form.health.failed`

Fired when a Pulse Monitor synthetic health-check run fails.

```json
{
  "version": "v1",
  "event": "form.health.failed",
  "createdAt": "2025-06-01T08:00:00.000Z",
  "workspaceId": "ws-uuid",
  "formId": "form-uuid",
  "data": {
    "healthMonitorId": "monitor-uuid",
    "healthRunId": "run-uuid",
    "failureStage": "form_located",
    "failureReason": "Could not find form element on page",
    "consecutiveFailures": 3,
    "incidentId": "inc_01j...",
    "failedAt": "2025-06-01T08:00:00.000Z"
  }
}
```

`data` fields:

| Field | Type | Notes |
|-------|------|-------|
| `healthMonitorId` | UUID | The monitor configuration that ran |
| `healthRunId` | UUID | This specific run attempt |
| `failureStage` | string | Where in the health-check pipeline it failed |
| `failureReason` | string | Human-readable failure description |
| `consecutiveFailures` | integer | Number of consecutive failures including this one |
| `incidentId` | string | Present when a new incident (`inc_…`) was opened |
| `failedAt` | ISO 8601 | |

---

### `form.schema.changed`

Fired when schema drift is detected — a field was added, removed, renamed, or
its type changed relative to the stored active schema version.

```json
{
  "version": "v1",
  "event": "form.schema.changed",
  "createdAt": "2025-06-01T10:00:00.000Z",
  "workspaceId": "ws-uuid",
  "formId": "form-uuid",
  "data": {
    "schemaDriftEventId": "drift-uuid",
    "kind": "field_renamed",
    "fieldName": "email",
    "previousDefinition": { "name": "email", "type": "email", "required": true },
    "observedDefinition": { "name": "Email", "type": "text", "required": true },
    "detectedAt": "2025-06-01T10:00:00.000Z"
  }
}
```

`data` fields:

| Field | Type | Notes |
|-------|------|-------|
| `schemaDriftEventId` | UUID | Unique ID for this drift event |
| `kind` | string | E.g. `field_renamed`, `field_removed`, `field_added`, `field_type_changed` |
| `fieldName` | string | The affected field (optional) |
| `previousDefinition` | object | The field's definition in the stored schema (optional) |
| `observedDefinition` | object | The field's definition as observed in the new submission (optional) |
| `detectedAt` | ISO 8601 | |

---

## Signature verification

### Algorithm

The signing payload is `<timestamp>.<rawBody>` — the Unix timestamp string,
a literal period character, and the raw request body bytes exactly as received.

```
signingPayload = timestamp + "." + rawBody
signature      = HMAC-SHA256(signingPayload, secret)
headerValue    = "sha256=" + hex(signature)
```

Implemented in `packages/webhooks/src/signing.ts`.

### Replay window

Reject any request where `|now − timestamp| > 300` seconds (5 minutes). This
prevents replayed captured requests.

### Constant-time comparison

Use `timingSafeEqual` (Node) or an equivalent constant-time function to
compare the expected and received signatures. A naive string `===` comparison
leaks information about the matching prefix length, enabling timing attacks.

---

## Verification example — Node.js

```javascript
const { createHmac, timingSafeEqual } = require("node:crypto");

const SIGNATURE_HEADER = "x-submitpulse-signature";
const TIMESTAMP_HEADER = "x-submitpulse-timestamp";
const REPLAY_WINDOW_SECONDS = 300;

function verifyWebhook(secret, rawBody, headers) {
  const rawTimestamp = headers[TIMESTAMP_HEADER];
  const rawSignature = headers[SIGNATURE_HEADER];

  if (!rawTimestamp || !rawSignature) {
    return { valid: false, reason: "Missing signature headers" };
  }

  const ts = parseInt(rawTimestamp, 10);
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: "Invalid timestamp" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
    return { valid: false, reason: "Timestamp outside replay window" };
  }

  if (!rawSignature.startsWith("sha256=")) {
    return { valid: false, reason: "Invalid signature format" };
  }

  const receivedHex = rawSignature.slice("sha256=".length);
  const signingPayload = `${ts}.${rawBody}`;
  const expectedHex = createHmac("sha256", secret)
    .update(signingPayload, "utf8")
    .digest("hex");

  const receivedBuf = Buffer.from(receivedHex, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  if (receivedBuf.length !== expectedBuf.length) {
    return { valid: false, reason: "Signature length mismatch" };
  }

  const match = timingSafeEqual(receivedBuf, expectedBuf);
  return match ? { valid: true } : { valid: false, reason: "Signature mismatch" };
}

// Express example
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const result = verifyWebhook(
    process.env.WEBHOOK_SECRET,
    req.body.toString("utf8"), // raw bytes as string — do NOT parse first
    req.headers,
  );

  if (!result.valid) {
    return res.status(400).json({ error: result.reason });
  }

  const event = JSON.parse(req.body);
  console.log("Received event:", event.event);
  res.sendStatus(200);
});
```

**Critical:** pass the raw, unparsed body to the verification function. Parsing
JSON and re-serializing it can change key ordering or whitespace, producing a
different byte sequence and causing verification to fail.

---

## Verification example — Python

```python
import hashlib
import hmac
import time

SIGNATURE_HEADER = "x-submitpulse-signature"
TIMESTAMP_HEADER = "x-submitpulse-timestamp"
REPLAY_WINDOW_SECONDS = 300


def verify_webhook(secret: str, raw_body: bytes, headers: dict) -> dict:
    raw_timestamp = headers.get(TIMESTAMP_HEADER)
    raw_signature = headers.get(SIGNATURE_HEADER)

    if not raw_timestamp or not raw_signature:
        return {"valid": False, "reason": "Missing signature headers"}

    try:
        ts = int(raw_timestamp)
    except ValueError:
        return {"valid": False, "reason": "Invalid timestamp"}

    now = int(time.time())
    if abs(now - ts) > REPLAY_WINDOW_SECONDS:
        return {"valid": False, "reason": "Timestamp outside replay window"}

    if not raw_signature.startswith("sha256="):
        return {"valid": False, "reason": "Invalid signature format"}

    received_hex = raw_signature[len("sha256="):]
    signing_payload = f"{ts}.{raw_body.decode('utf-8')}"
    expected_hex = hmac.new(
        secret.encode("utf-8"),
        signing_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    # Constant-time comparison
    if not hmac.compare_digest(received_hex, expected_hex):
        return {"valid": False, "reason": "Signature mismatch"}

    return {"valid": True}


# Flask example
from flask import Flask, request, abort
import json

app = Flask(__name__)

@app.route("/webhook", methods=["POST"])
def webhook():
    raw_body = request.get_data()  # raw bytes — do NOT call request.json first
    result = verify_webhook(
        secret=os.environ["WEBHOOK_SECRET"],
        raw_body=raw_body,
        headers=dict(request.headers),
    )
    if not result["valid"]:
        abort(400, result.get("reason"))

    event = json.loads(raw_body)
    print("Received event:", event["event"])
    return "", 200
```

---

## Worked HMAC verification example

Given:
- Secret: `whsec_testkey`
- Unix timestamp: `1717228800`
- Raw body: `{"version":"v1","event":"submission.created"}`

Signing payload:
```
1717228800.{"version":"v1","event":"submission.created"}
```

Expected signature computation (Node):
```javascript
const crypto = require("node:crypto");
const sig = crypto
  .createHmac("sha256", "whsec_testkey")
  .update('1717228800.{"version":"v1","event":"submission.created"}', "utf8")
  .digest("hex");
// → e.g. "a3f8...etc"

const header = `sha256=${sig}`;
```

Your verification code should reproduce this value from the request and compare
with `timingSafeEqual` / `hmac.compare_digest`.

---

## Retry behaviour

Failed deliveries (non-2xx response or network timeout) are retried with
exponential backoff. The retry schedule is defined in
`packages/webhooks/src/retry.ts` (not yet implemented in full).

After sustained failures, the endpoint is automatically disabled. The
`consecutive_failures` counter and `disabled_at` timestamp are visible in
the dashboard. Re-enable the endpoint after fixing your server.

**Your endpoint must respond within the timeout window.** Return any 2xx status
code to acknowledge delivery. Return 4xx to tell Submit Pulse not to retry
(permanent failure). Return 5xx or let the request time out to trigger a retry.

---

## Delivery ID

The `x-submitpulse-delivery-id` header is a unique UUID for each delivery
attempt. Retries of the same event produce a new delivery ID. The ID
corresponds to `webhook_deliveries.delivery_id` in the database.

Use the delivery ID to correlate your server logs with the Submit Pulse
delivery history in the dashboard.

---

## Idempotency

Use `x-submitpulse-delivery-id` to deduplicate retried deliveries. On retry,
the event `data` is identical but the delivery ID differs. If you record the
event `data.submissionId` (for `submission.*` events) you can additionally use
that as a natural dedup key.

---

## SDK usage

The `packages/webhooks` package exports `verifyWebhook()` directly if you are
running a Node.js server and have access to the package:

```typescript
import { verifyWebhook } from "@submitpulse/webhooks";

const result = verifyWebhook(
  process.env.WEBHOOK_SECRET!,
  rawBodyString,
  Object.fromEntries(req.headers.entries()),
);

if (!result.valid) {
  return new Response("Unauthorized", { status: 401 });
}
```

The function enforces the 300-second replay window and uses `timingSafeEqual`
automatically. It returns `{ valid: true }` or `{ valid: false, reason: string }`.
