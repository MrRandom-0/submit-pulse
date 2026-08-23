# 25 — Security Threat Model

## Methodology

STRIDE analysis. Each row identifies a threat category against a specific surface, assesses likelihood and impact, describes the control in place, and notes residual risk.

Likelihood scale: Low / Medium / High.
Impact scale: Low / Medium / High / Critical.

## Shared egress guard

Webhooks, Pulse Monitor, and the website scanner all make outbound HTTP calls to user-supplied URLs. All three surfaces share the same guard: `assertSafeEgressUrl()` from `packages/security/src/ssrf.ts`. This is a deliberate architectural decision to prevent three independent SSRF surfaces from requiring three independent implementations that could diverge.

**DNS rebinding caveat** (documented in `ssrf.ts`): Passing the egress guard check does not guarantee safety at connect time. A malicious DNS server can return a safe IP during the check and a private IP when the HTTP client resolves at connection time. The full mitigation requires:
1. Application-level DNS resolution before connecting.
2. Verification of the resolved IP against the same private-range rules.
3. Pinning the connection to that IP (disabling re-resolution on redirects).

In Cloudflare Workers, the platform-level egress policy provides an additional layer, but application-level validation is still required because the platform policy cannot be assumed in all deployment contexts.

## Surface: Dashboard

| # | Category | Threat | Likelihood | Impact | Control | Residual risk |
|---|---|---|---|---|---|---|
| D1 | Spoofing | Attacker forges a session token to access another user's workspace. | Low | High | Supabase Auth JWT validation; short-lived tokens; RLS backstop. | Supabase auth provider stub not wired; JWTs not validated in any route. |
| D2 | Tampering | Attacker modifies a form's settings via a crafted Server Action call. | Medium | Medium | `requireActor(workspaceId, permission)` enforced on every mutation. | `resolveMembership()` is a stub returning null; all actor checks fail. |
| D3 | Information disclosure | Attacker reads another workspace's submissions by guessing resource IDs. | Low | High | UUIDs; RLS `workspace_id = app.current_workspace_id()` predicate. | RLS not applied to any live database (no DB provisioned). |
| D4 | Elevation of privilege | Platform admin uses `isPlatformAdmin` to access tenant data. | Low | High | `can()` does not consult `isPlatformAdmin`; ambient superuser bit is absent. | Implemented and correct in code; not exercised. |

## Surface: Form ingestion endpoint

| # | Category | Threat | Likelihood | Impact | Control | Residual risk |
|---|---|---|---|---|---|---|
| I1 | Spoofing | Attacker impersonates a legitimate form submitter. | High | Low | Form IDs are not auth secrets (by design). Origin rules, CAPTCHA, and rate limits are the controls. | CAPTCHA is dev-bypass; rate limiter is in-memory (no shared state). |
| I2 | Tampering | Attacker crafts a payload that bypasses schema validation. | Medium | Medium | Zod-based schema validation; unexpected fields isolated to `unexpectedData`. | Validation is implemented; `D1FormRepository` not wired in production. |
| I3 | Repudiation | Attacker submits spam and claims the submission was not theirs. | Medium | Low | `request_id`, `fingerprint`, `ip_address`, `user_agent` recorded. | IP address stored; no proof-of-submission mechanism for disputes. |
| I4 | Denial of service | Attacker floods the endpoint with large bodies. | High | Medium | 25 MiB hard ceiling before form lookup; per-form limit after; rate limits. | Rate limiter in-memory only; 25 MiB ceiling is enforced in code. |
| I5 | Denial of service | Attacker floods one IP across many forms to exhaust rate limiter. | Medium | Medium | 60/min global IP limit. | InMemoryRateLimiter has no shared state; each worker restart resets counts. |
| I6 | Information disclosure | Error responses leak internal details. | Low | Low | All error factories use generic messages; no stack traces or query errors exposed. | Implemented and correct. |
| I7 | Elevation of privilege | Attacker submits a file that executes server-side. | Medium | Critical | Extension blocklist; magic-byte check; server-generated storage key; async antivirus. | Antivirus scanner is a stub; files are validated but never actually stored. |

## Surface: Authentication

| # | Category | Threat | Likelihood | Impact | Control | Residual risk |
|---|---|---|---|---|---|---|
| A1 | Spoofing | Attacker brute-forces a user password. | Medium | High | Supabase Auth rate limits; `security_events` log for `login_failure`. | Supabase Auth not wired; brute-force events not emitted. |
| A2 | Tampering | Attacker modifies an invitation token URL to accept as another user. | Low | High | Invitation token stored as SHA-256 hash; plaintext never stored; token tied to accepting email. | Implemented in schema; invitation handler not built. |
| A3 | Information disclosure | Account enumeration via login response timing differences. | Medium | Low | Generic error messages on login failure (Supabase handles this). | Delegated to Supabase Auth. |
| A4 | Spoofing | Attacker captures and replays a session cookie. | Low | High | HTTPS-only; Supabase JWT short-lived (1 hour); `session_revoked` event on logout. | HTTPS enforced by Cloudflare; JWT validation stubbed. |

## Surface: File uploads

| # | Category | Threat | Likelihood | Impact | Control | Residual risk |
|---|---|---|---|---|---|---|
| F1 | Tampering | Attacker uploads a polyglot file (valid image + embedded script). | Medium | High | Magic-byte family check; MIME-extension consistency check; antivirus scan. | Antivirus is a stub. |
| F2 | Information disclosure | Storage key guessable → unauthenticated file download. | Low | Medium | Storage keys are `uploads/<hash>/<uuid>.<ext>` (not guessable). | Download URL generation not implemented; storage not provisioned. |
| F3 | Denial of service | Attacker uploads 25 MiB files to exhaust storage quota. | High | Medium | Per-file size limit; aggregate quota per plan; file uploads require Pro plan. | Quota enforcement not implemented. |
| F4 | Elevation of privilege | Attacker crafts a filename containing path traversal (`../../etc/passwd`). | Medium | High | Storage key is server-generated; client filename is never used in a path. | Implemented and correct. |

## Surface: Webhooks

| # | Category | Threat | Likelihood | Impact | Control | Residual risk |
|---|---|---|---|---|---|---|
| W1 | SSRF | Attacker configures a webhook URL pointing at internal infrastructure. | High | Critical | SSRF egress guard (private ranges, loopback, metadata endpoints, non-standard ports). | DNS rebinding caveat (see above). Worker DB writes are stubs. |
| W2 | Spoofing | Attacker sends a forged webhook to a customer's endpoint. | Low | Medium | HMAC-SHA256 signature; 300-second replay window; constant-time comparison. | Signing implemented; delivery handler DB writes are stubs. |
| W3 | Information disclosure | Signing secret exposed via the database. | Low | High | Secret stored hashed (bcrypt/argon2); plaintext never stored. | Hash is correct; envelope key for integration credentials not implemented. |
| W4 | Denial of service | Attacker causes excessive deliveries to a dead endpoint. | Medium | Low | Auto-disable after consecutive failures; response body snippet capped. | DB writes that perform auto-disable are stubs. |

## Surface: Email

| # | Category | Threat | Likelihood | Impact | Control | Residual risk |
|---|---|---|---|---|---|---|
| E1 | Spoofing | Platform sends email from a spoofed From address. | Low | Medium | SPF/DKIM/DMARC delegated to Resend. | Resend not configured; emails not sending. |
| E2 | Tampering | Attacker injects content into notification email via submitted data. | Medium | Medium | All user content must be HTML-escaped via `packages/email/src/templates/escape.ts` before rendering. | Templates exist; delivery worker is a stub. |
| E3 | Denial of service | Autoresponder triggered for synthetic submissions → mail loop. | Medium | Medium | Worker skips autoresponders for `origin='synthetic'` submissions. | Documented in schema; handler is a stub. |
| E4 | Privacy | Notification sent to an unverified email destination. | Medium | Medium | `email_destinations.verified_at` must be set before deliveries; verification flow via challenge link. | Verification handler not implemented. |

## Surface: Billing

| # | Category | Threat | Likelihood | Impact | Control | Residual risk |
|---|---|---|---|---|---|---|
| B1 | Tampering | Attacker manipulates plan by forging a Stripe webhook. | High | High | `Stripe-Signature` header must be verified before trusting payload. | Stripe webhook handler not implemented. |
| B2 | Denial of service | Attacker submits repeatedly to exhaust a free plan's quota. | High | Low | Plan quotas enforced at submission acceptance; free plan is 100/month. | Quota enforcement not implemented. |

## Surface: Health scanner (Pulse Monitor)

| # | Category | Threat | Likelihood | Impact | Control | Residual risk |
|---|---|---|---|---|---|---|
| H1 | SSRF | User configures `targetUrl` to scan internal infrastructure. | High | Critical | Same SSRF egress guard used for webhooks. | DNS rebinding caveat. Health check handler is a stub. |
| H2 | Repudiation | Synthetic submissions counted in billing metrics. | Medium | Medium | `origin='synthetic'` excluded from all billing aggregates. | Logic correct; worker not implemented. |

## Surface: MCP server

The MCP server does not exist; no threat analysis is applicable until source code is written.

## Surface: Admin

| # | Category | Threat | Likelihood | Impact | Control | Residual risk |
|---|---|---|---|---|---|---|
| Ad1 | Elevation of privilege | Platform admin escalates to read tenant data without audit trail. | Low | High | No ambient superuser in `can()`; support escalation must be explicit and logged to `audit_logs`. | Audit log table exists; escalation mechanism not implemented. |
| Ad2 | Spoofing | Attacker accesses `/admin` without `is_platform_admin`. | Low | High | `users.is_platform_admin` flag; `requireSession()` + platform admin check on admin routes. | Admin routes not implemented. |
