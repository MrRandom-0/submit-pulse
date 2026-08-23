# 19 — Schema Drift

Source: `packages/database/src/schema/health.ts` (`schema_drift_events` table), `packages/config/src/integration-prompts.ts`

## What schema drift is

Schema drift occurs when the form payload received from a deployed website does not match the expected field schema declared in Submit Pulse. Common causes:

- An AI builder regenerated a component and renamed a field (e.g. `email` became `Email` or `user_email`).
- The developer added or removed a field without updating the schema version.
- A design change altered the HTML `name` attribute of an input.

## Detection

Drift is detected at ingestion time during schema validation (stage 5 of the pipeline). Fields in the request payload that are absent from the active schema version are stored in `submissions.unexpected_data` rather than in `submissions.data`.

The queue worker inspects `unexpected_data` and creates or updates `schema_drift_events` rows.

## Safety invariant

From the schema comment: "Drift is NEVER auto-applied destructively. A `field_removed` or `type_changed` event is informational; no data is dropped, no schema is mutated, and no validation rules are loosened until a workspace member explicitly reviews and accepts the change."

This invariant must be maintained at the application layer. Nothing in the database enforces it.

## Drift kinds

`drift_kind` enum:

| Kind | Meaning |
|---|---|
| `field_added` | A new field appeared in the payload that is not in the schema. |
| `field_removed` | A schema field was absent from the payload. |
| `field_renamed` | Strong evidence of a rename (one field added, one removed simultaneously). |
| `type_changed` | The field is present but its value type differs from the declared type. |
| `required_changed` | A required field is now optional or vice versa. |
| `validation_changed` | Constraint metadata changed (e.g. max length). |
| `unexpected_payload` | The payload structure does not match expectations in a broader way. |

## `schema_drift_events` table

| Column | Notes |
|---|---|
| `submission_id` | The submission that first exposed this drift. Set null when purged by retention. |
| `kind` | drift_kind enum. |
| `resolution` | `unresolved`, `accepted`, `mapped`, `ignored`. |
| `field_name` | Affected field name (when applicable). |
| `previous_definition` | Schema definition before the change. |
| `observed_definition` | What was actually observed. |
| `detected_at` | When drift was first seen. |
| `occurrence_count` | How many times this drift pattern has been observed. Incremented rather than creating duplicate rows. |
| `ai_repair_prompt` | AI-generated prompt describing how to fix the form. |
| `ai_repair_generated_at` | When the prompt was generated. |
| `from_schema_version_id` | Schema version active at detection. |
| `to_schema_version_id` | Schema version created on acceptance (null until `accepted` or `mapped`). |

CHECK: `to_schema_version_id IS NULL OR resolution IN ('accepted', 'mapped')`.

CHECK: `ai_repair_generated_at IS NULL OR ai_repair_prompt IS NOT NULL`.

## Resolution workflow

1. Dashboard shows unresolved drift alerts (requires `schema_drift:resolve` permission).
2. User reviews the evidence: which field changed, what the old and new values looked like.
3. Options:
   - **Accept**: The changed field is correct; create a new schema version reflecting it.
   - **Map**: The new field name maps to an existing field (rename case); create a mapping rule.
   - **Ignore**: This is a known deviation; stop alerting on it.
4. Resolution is recorded in `schema_drift_events.resolution` and optionally `resolved_at`, `resolved_by_user_id`.

## AI repair prompt

When drift is detected and the `aiRepair` feature is enabled (Pro/Agency), `generateRepairPrompt()` from `packages/config/src/integration-prompts.ts` produces a prompt. The user copies it into their AI builder to rename the field.

The prompt includes:
- Evidence of the mismatch (deployed field name vs expected field name).
- Instructions to rename every reference in the form integration.
- Scope warning: update ONLY the form integration, not unrelated code.
- The full field schema for reference.
- Verification step: submit the form and confirm the correct field name appears in the network request.

## Plan gating

`schemaDrift` and `aiRepair` features are enabled on Pro and Agency plans only. Free and Starter users can see drift in the UI but cannot access AI repair prompts or the full schema version history.
