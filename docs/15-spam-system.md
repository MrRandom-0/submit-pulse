# 15 — Spam System

## Overview

The spam system has two stages:
1. **Synchronous inline scoring** — runs in the ingestion pipeline on every request.
2. **Async AI analysis** — runs in the queue consumer worker (not yet implemented).

## Synchronous spam evaluation

Source: `apps/ingest/src/pipeline/spam-rules.ts`

### Signals

| Signal | Code | Verdict | Notes |
|---|---|---|---|
| Honeypot populated | `honeypot_triggered` | `blocked` | Returns 400 immediately; submission not stored. |
| IP in blocklist | `ip_blocked` | `spam` / `blocked` | Checks against `spam_rules` of kind `blocklist_ip`. |
| Keyword in payload | `keyword_match` | `suspicious` / `spam` | Checks against `blocklist_term` rules. |
| Allowlisted email | `email_allowlisted` | Reduces score | `allowlist_email` rules with negative weight. |
| Regex match | varies | varies | `regex` kind rules. |

Score is a float in [0, 1]. Signals are weighted by the `spam_rules.weight` column (range -1 to 1). Negative weights reduce the score (allowlisting effect).

### Verdicts

| Verdict | Meaning | Action |
|---|---|---|
| `clean` | Score below threshold | Store and deliver normally. |
| `suspicious` | Score above low threshold | Store; may flag in UI. |
| `spam` | Score above high threshold | Store in spam folder; suppress delivery. |
| `blocked` | Honeypot or explicit block rule | Return 400; do not store. |

Threshold values are not yet exposed in the UI or configurable per form in the current code. The `spam_decisions` table stores the verdict and all contributing signals with evidence.

### Spam rules loading

In the current implementation, custom spam rules are loaded as an empty array:

```typescript
evaluateSpam(
  cleanPayload,
  form.honeypotFieldName,
  clientIp,
  [] as SpamRule[], // TODO: load from DB in D1FormRepository when implemented
);
```

Only the honeypot check works end-to-end without a database.

## Spam decisions storage

`spam_decisions` table (one row per submission, unique constraint):

- `verdict`: the automated verdict.
- `score`: float [0, 1].
- `signals`: jsonb array of `{code, label, weight, evidence?}`. This is what the dashboard shows as "why was this spam?"
- `overridden_by_user_id`, `overridden_at`, `override_verdict`: set when a user manually overrides the verdict.

CHECK constraint: `(overridden_at IS NULL) = (override_verdict IS NULL)` — override must be all-or-nothing.

## Human override

Users with `submission:restore_spam` permission can override the automated verdict. This writes `override_verdict` and `overridden_at` to `spam_decisions`. The original automated verdict is preserved for audit.

## AI analysis (async, not yet implemented)

The intended flow (from the `docs/01-product-overview.md` and schema design):
1. Queue consumer picks up the `process-submission` job.
2. AI analysis runs against the full payload.
3. If the verdict differs from the inline verdict, `spam_decisions` is updated.
4. Incident is raised if anomalous patterns are detected across multiple submissions.

The `ai_analyses_per_month` quota exists in `entitlements.ts`: Free (0), Starter (0), Pro (500/month), Agency (2,500/month).

## Plan-gated features

From `packages/config/src/entitlements.ts`:

| Feature | Free | Starter | Pro | Agency |
|---|:---:|:---:|:---:|:---:|
| Basic spam (honeypot, blocklists) | Y | Y | Y | Y |
| `advancedSpam` (AI analysis, regex rules) | | | Y | Y |

## Spam rule management

`spam_rules` rows can be:
- Workspace-level (null `form_id`): applies to all forms.
- Form-level: applies only to a specific form.

`kind` options: `blocklist_term`, `blocklist_email`, `blocklist_ip`, `allowlist_email`, `regex`.

Target field (`target_field`): null means check all text fields. When set, the rule only fires on the specified field name.
