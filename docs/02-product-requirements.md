# 02 — Product Requirements

These requirements are derived from what the code declares it intends to do. They are not verified against a running system.

## Functional requirements

### Form management

- A workspace may create up to the plan quota of forms.
- Each form has a unique public identifier (`fm_` prefix, 22+ base62 characters, enforced by CHECK constraint).
- A form may be active, paused, or archived. Paused forms return 404 to submitters (the UI does not reveal that the form exists).
- A form may have multiple allowed origin domains (`form_domains`). Origin enforcement is optional per form.
- A form may have one active schema version. Historical versions are immutable.
- A form may have one autoresponder.
- A form may rotate its public endpoint identifier; old identifiers remain valid until `retiresAt`.

### Submission ingestion

- The ingestion endpoint accepts `application/json` and `multipart/form-data`.
- Maximum body size: configurable per form (default 1 MiB, maximum 25 MiB). A global hard ceiling of 25 MiB is enforced before form lookup.
- Idempotency key: optional `Idempotency-Key` header. Repeat requests with the same key return the original submission.
- Rate limits (defined in `apps/ingest/src/pipeline/rate-limit.ts`):
  - 60 submissions per IP per minute (global).
  - 10 submissions per IP per form per 5 minutes.
  - 500 submissions per form per minute.
- Accepted submissions return HTTP 202 with `{ ok: true, requestId, submissionId }`.
- Spam-blocked submissions return HTTP 400 with `{ ok: false, error: { code: "SUBMISSION_BLOCKED" } }`.

### Spam protection

- Synchronous inline signals: honeypot field check, IP blocklist, keyword blocklist.
- Score range: 0 (clean) to 1 (spam). Threshold for "spam" verdict: configurable (not yet exposed in UI).
- Blocked verdict (honeypot populated): returns 400 immediately. Does not persist.
- Spam verdicts are stored in `spam_decisions` with per-signal evidence for explainability.
- Human override: any user with `submission:restore_spam` permission may override the verdict.

### Email delivery

- Per-form notification destinations, each verified via a challenge email.
- Optional `includedFields` allowlist per destination; null means all non-internal fields.
- Optional `replyToFieldName` to set Reply-To from submitted data.
- One autoresponder per form. Skipped for synthetic and spam submissions.
- Delivery attempts are recorded in `email_deliveries` with idempotency keys.

### Webhooks

- HMAC-SHA256 signed payloads. Secret shown once at creation, stored hashed.
- Replay window: 300 seconds. The `verifyWebhook` helper enforces this.
- Events: `submission.created`, `submission.updated`, `submission.spam`, `submission.restored`, `form.health.failed`, `form.schema.changed`.
- Auto-disable endpoint after sustained consecutive failures.
- Response body stored as a snippet (capped to prevent storage abuse).

### Pulse Monitor

- One monitor per form.
- Interval: 5 to 1440 minutes.
- Target URL must be HTTPS and pass the SSRF egress guard.
- Synthetic submissions are marked `origin='synthetic'` and excluded from billing, analytics, autoresponders, and integrations.
- Incidents are opened after configurable consecutive failures; auto-resolved on recovery.

### Schema drift detection

- Detected when an incoming payload contains fields absent from, or differently typed than, the active schema version.
- Drift is NEVER auto-applied. Workspace member must explicitly accept.
- AI repair prompt is generated and stored in `schema_drift_events.ai_repair_prompt`.

### File uploads

- Disabled by default; must be explicitly enabled per form.
- Extension allowlist, MIME type allowlist, magic-byte verification.
- Server-generated storage key (never derived from client filename).
- Async antivirus scan via the `scan-file` worker handler.
- File uploads require Pro plan or above.

### Access control

- Four workspace roles: owner, admin, developer, viewer.
- Full permission matrix in `packages/auth/src/permissions.ts`.
- Platform admins do not get ambient access to tenant data; support access requires an explicit, audited escalation.

## Non-functional requirements

### Performance targets (intended, unverified)

- Ingestion p50 latency: under 200 ms (synchronous pipeline only, excluding queue).
- Ingestion p99 latency: under 500 ms.
- Worker job throughput: sufficient to drain queue within 60 seconds of ingestion.

These targets are stated as design intent. No benchmarks exist; see `docs/29-load-testing.md`.

### Security

- All outbound HTTP (webhooks, Pulse Monitor, scanner) must pass the shared SSRF egress guard.
- Row Level Security enforced at database level as a backstop.
- No credential stored in plaintext. API keys, webhook secrets, and invitation tokens are stored as SHA-256 hashes.
- Integration credentials (`integrations.credentials`) must be envelope-encrypted (application-layer responsibility, not yet implemented).

### Reliability

- At-least-once delivery for all queue jobs. Idempotency enforced in each handler.
- Dead-letter queue for jobs that exhaust retries.

### Privacy

- Submission `ip_address` stored truncated/normalised.
- Retention configurable per plan, per workspace, and per form.
- A retention sweep job purges rows after `purge_after`.
