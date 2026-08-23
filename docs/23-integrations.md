# 23 — Integrations

Sources: `packages/database/src/schema/delivery.ts`, `packages/database/src/schema/enums.ts`.

---

## Overview

Third-party integrations route submitted data to external services after a submission is accepted and processed. The integration feature is gated by the `integrations` entitlement (Pro and Agency plans only).

---

## Supported providers

The `integration_provider` Postgres enum defines all supported services:

| Provider | Category |
|---|---|
| `slack` | Messaging |
| `discord` | Messaging |
| `telegram` | Messaging |
| `google_sheets` | Spreadsheet |
| `airtable` | Database |
| `notion` | Database |
| `zapier` | Automation platform |
| `make` | Automation platform |
| `generic_webhook` | Custom HTTP endpoint |

**No integration delivery code is implemented.** The `integrations` table and enum exist. The worker handler that would read integration configurations and dispatch delivery does not exist.

---

## Scope (workspace vs form level)

An integration can be scoped in two ways:

- **Workspace-level** (`form_id IS NULL`): receives events from all forms in the workspace.
- **Form-level** (`form_id` set): scoped to a single form.

A partial unique index enforces: one workspace-level integration per provider per workspace, and one form-level integration per provider per form. This index uses a `WHERE form_id IS NULL` predicate (for workspace-level) and a standard composite unique (for form-level). The design is described in `docs/10-database-schema.md`.

---

## Integration configuration fields

From `packages/database/src/schema/delivery.ts`:

| Column | Type | Description |
|---|---|---|
| `provider` | `integration_provider` enum | Which service |
| `enabled` | boolean | On/off toggle |
| `form_id` | uuid nullable | Null for workspace-level |
| `config` | jsonb | Non-secret configuration (target channel, sheet ID, field mappings) |
| `credentials` | jsonb | Encrypted secrets (OAuth tokens, API keys) — MUST BE ENCRYPTED |
| `last_test_at` | timestamp | When the connection was last tested |
| `last_test_ok` | boolean | Result of the last connection test |
| `last_error_text` | text | Failure reason from the last test |

---

## Credentials encryption

The schema comment on `integrations.credentials` is unambiguous:

> "THIS COLUMN MUST BE ENCRYPTED AT REST using the envelope encryption scheme in packages/security before being written and decrypted after being read. Never store plaintext tokens in this column."

**The envelope encryption module does not exist.** `packages/security/src/` contains `hash.ts`, `ssrf.ts`, `origin.ts`, `rate-limit.ts`, `captcha.ts`, and `file-validation.ts`. There is no encryption module. Integration credentials cannot be stored safely in the current state.

---

## Plan gating

| Feature | Free | Starter | Pro | Agency |
|---|:---:|:---:|:---:|:---:|
| `integrations` | No | No | Yes | Yes |

Required permission: `integration:manage` (Developer role and above).

---

## Dashboard surface (`/integrations`)

**Source**: `apps/web/src/app/(dashboard)/integrations/page.tsx`

The page is intended to show:
- Webhook endpoints list with delivery success rate and last delivery status.
- Per-provider integration status cards.
- Connect / disconnect controls for each provider.

No fixture data is wired to this page in the current state.

---

## Webhook delivery (separate from integrations)

Outbound webhooks are configured separately from third-party integrations. Webhook endpoints are stored in `webhook_endpoints`. The `deliver-webhook` worker handler sends HTTP POSTs with HMAC signatures (see `docs/17-webhooks.md`). The HTTP call in `deliver-webhook` is functional; all database writes are TODO stubs.

Webhooks and integrations are listed together in the `/integrations` dashboard route but are distinct systems.

---

## What needs to be built

1. Implement the envelope encryption module in `packages/security/`.
2. Implement the worker handler for integration delivery (read configuration per form, dispatch per provider).
3. Implement per-provider delivery clients (Slack Incoming Webhooks API, Google Sheets API, Airtable API, Notion API, Zapier/Make webhook POST).
4. Wire credential decryption before passing to provider clients.
5. Verify SSRF safety for `generic_webhook` (user-configured URL) via the existing `safeFetch()` guard.
6. Wire `integration:manage` permission checks to the configuration UI.
