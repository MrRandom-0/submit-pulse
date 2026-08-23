# 13 — Authentication

## Auth provider

Authentication is delegated to Supabase Auth. The application stores no password hashes; credential storage is the provider's responsibility.

The provider interface is defined in `packages/auth/src/provider.ts`. Two implementations exist:

| File | When used | Status |
|---|---|---|
| `packages/auth/src/supabase-provider.ts` | Production | Stub — marked "INCOMPLETE — NOT PRODUCTION VERIFIED" |
| `packages/auth/src/dev-provider.ts` | Development | Does not enforce passwords |

The session module (`packages/auth/src/session.ts`) uses a module-level singleton. `setProvider()` must be called once at application startup before any session helper is used. The code comment in `session.ts` says to do this in `instrumentation.ts`. This wiring does not exist in the codebase. Authentication cannot succeed in the current state.

---

## Critical limitation

`resolveMembership()` in `packages/auth/src/session.ts` is marked INCOMPLETE and **always returns null**. This means:

- `getActor(workspaceId)` always returns null.
- `requireActor(workspaceId, permission)` always throws `AuthorizationError` or redirects to `/login`.
- No authenticated database access is possible.

---

## Session helpers

From `packages/auth/src/session.ts`:

| Helper | Returns | Behaviour |
|---|---|---|
| `getSession()` | `AuthSession \| null` | Never throws. Returns null when unauthenticated or when the provider is not wired. |
| `requireSession(nextUrl?)` | `AuthSession` | Redirects to `/login?next=<url>` when no session exists. |
| `getActor(workspaceId)` | `Actor \| null` | Resolves session → workspace membership. Returns null (always, currently). |
| `requireActor(workspaceId, permission)` | `Actor` | Asserts membership and permission. Throws `AuthorizationError` or redirects. |

---

## Password policy

`packages/auth/src/password-policy.ts` defines strength requirements enforced at registration and password-change time. The specific rules are in that file. Supabase Auth enforces these constraints server-side; the policy module exports a validator for client-side feedback.

---

## JWT / session tokens

Supabase Auth issues JWTs. The server-side Supabase client validates these via the service role key. Session cookies are managed by the Supabase client library. The Next.js middleware uses Supabase's cookie-based session management.

---

## Workspace invitation flow

Invitations use the `invitations` table:

1. Admin creates invitation → a random token is generated. The **SHA-256 hash** of the token is stored in `invitations.token_hash`. The plaintext token is emailed once via the workspace-invitation template (`packages/email/src/templates/workspace-invitation.ts`).
2. Recipient clicks the link → the application hashes the URL token and queries for the matching `invitations` row.
3. On match: the invitation is marked `accepted_at`, a `workspace_members` row is created, and the user is redirected into the workspace.

A database read of `invitations` cannot be replayed for access: the plaintext token must be in the URL. This prevents replay attacks on the stored hash.

---

## API key authentication

API keys follow the same hash pattern: SHA-256 stored in `api_keys.key_hash`; plaintext shown once at creation. The `key_prefix` column (e.g. `submitpulse_live_a1b2`) is non-secret and used for display in the UI.

Key prefixes:
- `submitpulse_live_...` — live keys
- `submitpulse_test_...` — test keys

Intended validation flow (not yet implemented in any route handler):

1. Extract `Authorization: Bearer <key>` header.
2. Compute SHA-256 of the key.
3. Query `api_keys WHERE key_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`.
4. Resolve the workspace actor from the matching row.
5. Apply `credentialScopes` intersection: the actor's role grants one set of permissions; the key's scopes grant another; only the intersection is allowed.

---

## Installation tokens (AI agent credentials)

`installation_tokens` are short-lived credentials issued to AI coding agents during the setup flow. They are scoped to a specific form and workspace.

Schema constraints (from `packages/database/src/schema/platform.ts`):

- `expiresAt > createdAt` (CHECK constraint — enforced by the database).
- `max_uses >= 1` (CHECK constraint).
- `use_count >= 0` (CHECK constraint).
- Default: `max_uses = 10`.

**Permitted operations** (from schema comment):
- Read public form configuration.
- Read the active form schema version.
- Generate code snippets.
- Run a single test submission.
- Validate the generated integration.

**Must never** (from schema comment):
- Read, export, or enumerate real submission data.
- Access billing details or subscription status.
- Read or modify workspace membership.
- Delete or archive a form.
- Mint permanent credentials.

The MCP server (`apps/mcp/src/auth.ts`) defines three scopes: `forms:read`, `integration:generate`, `health:check`. No scope grants submission content access.

---

## Multi-factor authentication

`users.mfa_enrolled_at` records when a user enrolled in MFA. MFA enforcement is intended at dashboard access but is not implemented in any route handler or middleware.

---

## Email verification

`users.email_verified_at` is set after the user clicks the verification link. The `/verify-email` route gates dashboard access until verification is confirmed. The verification email template is at `packages/email/src/templates/email-verification.ts`.
