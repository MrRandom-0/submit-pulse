# 04 — User Flows

These flows describe the intended experience as implemented in the onboarding, dashboard, and ingestion code. Dashboard screens currently render fixture data; the flows describe the intended wired state.

## Flow 1: New user onboarding

Source: `apps/web/src/components/onboarding/` and `apps/web/src/app/(onboarding)/onboarding/page.tsx`.

1. User signs up (email/password via Supabase Auth, or OAuth if configured).
2. Email verification is required before accessing the dashboard.
3. Onboarding wizard opens. Steps inferred from component files:
   - `step-builder.tsx`: Pick the AI builder or framework used to build the site.
   - `step-template.tsx`: Choose a form template (contact, newsletter, job application).
   - `step-details.tsx`: Name the form, enter the website URL.
   - `step-endpoint.tsx`: Displays the generated endpoint URL and the integration prompt.
4. User copies the integration prompt and pastes it into their AI builder or code editor.
5. Dashboard is available with fixture data until the first real submission arrives.

## Flow 2: First submission received

1. The user's deployed form is submitted by a visitor.
2. `POST /v1/forms/:publicFormId/submissions` reaches the ingestion edge worker.
3. Pipeline runs synchronously (size → lookup → rate limit → origin → schema → captcha → spam → files → persist → enqueue).
4. HTTP 202 returned to the browser within target latency.
5. Queue consumer processes the job asynchronously: email notification sent, webhooks fired, analytics counters updated.
6. Dashboard submission inbox shows the new entry (currently fixture data).

## Flow 3: Schema drift detected

1. A visitor submits a form whose field names differ from the declared schema (e.g. the AI builder renamed a field).
2. The ingestion pipeline records the unexpected fields in `submissions.unexpected_data`.
3. The queue worker creates a `schema_drift_events` row.
4. AI repair prompt is generated and stored in `schema_drift_events.ai_repair_prompt`.
5. Incident may be raised if health monitor detects repeated drift.
6. Dashboard shows a drift alert. User clicks "Generate fix" → copies repair prompt → pastes into their builder.
7. After the builder redeploys, the field names match; the drift event is resolved.

## Flow 4: Health monitor alerts

1. User configures a Pulse Monitor with their form's deployed page URL.
2. Monitor runs on schedule (5–1440 minute interval). It loads the page, finds the form, submits synthetic data, and checks the ingestion API returns 202.
3. On failure, `health_runs` row is written with `status='failed'` and step breakdown.
4. Incident is opened. Alert email sent to configured addresses.
5. Dashboard Pulse page shows the failing form. User sees per-stage failure detail.
6. User fixes the form and re-deploys. Monitor detects recovery (a passing run). Incident auto-resolves.

## Flow 5: Developer API key workflow

1. Developer logs in, navigates to Settings → API Keys.
2. Creates a key with a name and optional expiry. Key is displayed once in plaintext; only the SHA-256 hash is stored.
3. Developer uses the key in server-to-server calls or CI pipelines.
4. Key can be revoked; revocation is immediate (key hash lookup fails).

## Flow 6: Webhook setup

1. Developer navigates to Integrations → Webhooks.
2. Adds an endpoint URL (must be HTTPS; SSRF-checked at delivery time).
3. Selects event types to subscribe to.
4. Platform shows the signing secret once; developer stores it in their server's environment.
5. On every subscribed event, the platform signs the payload with HMAC-SHA256 and delivers.
6. Developer's server calls `verifyWebhook()` (from `packages/webhooks/src/signing.ts`) to verify the signature and replay window.

## Flow 7: Agency client workspace creation

1. Agency admin navigates to Agency Dashboard → Add Client.
2. Creates a client workspace; `kind='client'`, `parent_workspace_id` set to the agency workspace ID.
3. Invites client users to their own workspace with viewer or developer role.
4. Agency members retain read access to all client workspaces via the RLS parent-join policy.
5. White-label reports can be generated with the agency's branding overrides (`workspaces.branding` JSONB column).
