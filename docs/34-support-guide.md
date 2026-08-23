# 34 — Support Guide

## Status

No support tooling, ticketing system, or escalation workflow is configured. Support contacts are brand constants only.

## Contact addresses (brand constants)

- General support: `support@submitpulse.com`
- Security: `security@submitpulse.com`
- Abuse: `abuse@submitpulse.com`
- Privacy: `privacy@submitpulse.com`

## Common customer issues

### "My form is not submitting"

1. Ask for the form's endpoint URL.
2. Check that the endpoint URL matches the pattern `https://api.submitpulse.com/v1/forms/fm_xxx/submissions`.
3. Ask the customer to open browser DevTools → Network tab and attempt a submission. What HTTP status code is returned?
   - 404: form is paused, archived, or the public ID is wrong.
   - 403: origin is not in the allowed list.
   - 400 with `CAPTCHA_FAILED`: Turnstile token is missing or invalid.
   - 413: body exceeds the size limit.
   - 429: rate limited.
4. Check `submission_events` for the most recent failed submission.
5. If the endpoint is unreachable: check Cloudflare Workers status.

### "I'm not receiving notification emails"

1. Check `email_destinations` — is the destination's `verified_at` set?
2. Check `email_deliveries` for the relevant submission ID. What is the `status`? Is there a `last_error`?
3. Check whether the submission's `spam_verdict` is `spam` (notifications are suppressed for spam).
4. Check whether the submission has `origin='synthetic'` (notifications are suppressed for synthetic submissions).
5. If delivery was attempted: check the Resend dashboard for bounce or block events.

### "My webhook is not firing"

1. Check `webhook_endpoints` — is `enabled = true`? Is `disabled_at` null?
2. Check `webhook_deliveries` for the endpoint. What `status` and `response_status` are recorded?
3. Verify the endpoint's URL passes the SSRF check (must be HTTPS, public IP, standard port).
4. Confirm the endpoint is subscribed to the relevant event type (`events` column).
5. Check `consecutive_failures` — if it reached the auto-disable threshold, `disabled_at` will be set.

### "I see spam submissions in my inbox"

1. Check `spam_decisions` for the submission — what signals contributed to the verdict?
2. If the verdict is wrong: the customer can restore the submission (requires `submission:restore_spam` permission).
3. If the customer wants to block a pattern: add a `spam_rules` entry.
4. If honeypot is not working: verify `forms.honeypot_field_name` matches the actual hidden field `name` attribute in the HTML.

### "My Pulse Monitor is failing"

1. Check `health_runs` for the most recent run. What is `failure_stage`?
2. Check the `steps` array for the exact stage breakdown.
3. Common failures:
   - `page_loaded` failed: the URL is unreachable or not public.
   - `form_located` failed: the form element could not be found on the page.
   - `fields_matched` failed: form fields don't match the schema (schema drift).
   - `api_accepted` failed: the ingestion endpoint returned an error.
4. If schema drift is the cause: direct the customer to the schema drift repair workflow.

## Accessing customer data (escalation)

Platform engineers must NOT access tenant data without a documented support escalation. The `can()` function does not grant platform admin users elevated permissions.

When a support escalation is required:
1. Document the customer request and consent in a support ticket.
2. Write an `audit_logs` row with `actor_type='support'` before performing any read.
3. Use the minimum necessary access (e.g., read a specific submission ID rather than dumping the whole workspace).
4. Document what was accessed and for what purpose.

This procedure is described in the code comments in `permissions.ts` but is not enforced by tooling.
