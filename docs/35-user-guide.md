# 35 — User Guide

## Getting started

### 1. Create an account

Go to `https://app.submitpulse.com/signup`. Enter your email and a strong password. Check your inbox for a verification email and click the link.

### 2. Complete onboarding

After email verification, the onboarding wizard opens.

**Step 1: Choose your builder.** Select the tool you used to build your website. The integration prompt is tailored to your choice. Options include Lovable, Bolt, Cursor, Claude Code, v0, Framer, Webflow, plain HTML, and more.

**Step 2: Choose a template.** Pick a starting form shape (Contact Us, Newsletter Signup, Job Application, or start blank).

**Step 3: Name your form.** Give the form a name and enter your website URL (used for Pulse Monitor).

**Step 4: Copy the endpoint and integration prompt.** Your form's submission URL is shown. If your builder supports a coding agent, a prompt is generated. Paste it into the agent chat.

### 3. Wire up your form

The integration prompt tells your AI builder exactly what to do. For visual editors (Framer, Webflow), manual configuration steps are shown instead.

If you are coding manually, copy the generated snippet from the integration step. It handles:
- POST to the endpoint.
- JSON or multipart/form-data encoding.
- Loading state while the request is in flight.
- Error display if the server returns a problem.
- Success state after a 202 response.

### 4. Submit a test submission

Open your website in a browser, fill in the form, and submit it. Return to the Submit Pulse dashboard. The submission should appear in the inbox.

If the submission does not appear:
- Open browser DevTools → Network tab → look for the request to `api.submitpulse.com`.
- Check the HTTP status and response body for an error code.
- Common issues: the endpoint URL is wrong; the form is paused; the origin is not in the allowed list.

## Managing forms

### Creating a form

Dashboard → Forms → New Form.

Fields can be added with drag-and-drop ordering. Each field has:
- **Name**: the wire name (what the HTML `name` attribute must match exactly).
- **Label**: display label for UI and notification emails.
- **Type**: text, email, phone, number, URL, date, textarea, select, multiselect, checkbox, hidden, file.
- **Required**: whether the field is mandatory.
- **Internal**: excludes the field from notification emails and exports (useful for honeypot fields).
- **Sensitive**: redacts the field value in the UI and exports.

### Allowed origins (CORS)

Add the domains your form is hosted on. The platform will reject submissions from any other origin when origin enforcement is enabled. Include:
- Your production domain (e.g. `acme.com`).
- Vercel preview domains if you test on those (check "Include subdomains" for `acme.vercel.app`).

Toggle "Allow localhost" for development convenience.

### Bot protection

**Honeypot field**: add a hidden field to your HTML that bots will fill in. Set the field name in Submit Pulse. Any submission that includes a value for this field is blocked immediately.

**CAPTCHA**: enable Cloudflare Turnstile. You will need to add the Turnstile widget to your form. The integration prompt includes instructions for this when CAPTCHA is enabled.

### Pausing and archiving

- **Pause**: stops accepting new submissions. Visitors get a 404 (the UI does not reveal the form exists). Use to temporarily stop a form without losing its configuration.
- **Archive**: for forms no longer in use. Same effect as pausing.

## Viewing submissions

Dashboard → Submissions (workspace-wide) or a specific form's submission tab.

Each submission shows:
- Spam verdict (clean / suspicious / spam).
- Status (new / viewed / qualified / in_progress / replied / closed / archived).
- Preview fields.
- Country, referrer, processing time.

Click a submission to see the full detail view: all field values, spam signal breakdown, processing timeline, file attachments, and internal notes.

### Spam management

Submissions with verdict `spam` are hidden from the main inbox. They are accessible via the spam filter. If a submission is wrongly classified:
1. Open the submission detail.
2. Click "Mark as not spam" (requires `submission:restore_spam` permission).

### Internal notes

Add notes to a submission for team collaboration. Notes are not visible to submitters.

### Tags

Apply tags to categorise submissions (e.g. "priority", "enterprise-lead"). Tags are searchable and filterable.

## Email notifications

Dashboard → Form → Notifications → Add destination.

For each destination:
- Enter the recipient email address.
- Verify ownership via the challenge email.
- Optionally set a custom subject template with `{{fieldName}}` tokens.
- Set a Reply-To field so recipients can hit "reply" to reach the submitter.
- Optionally select specific fields to include (null = all non-internal fields).

## Webhooks

Dashboard → Integrations → Webhooks → Add endpoint.

1. Enter the HTTPS endpoint URL.
2. Select event types.
3. Copy the signing secret (shown once).
4. Verify the secret in your server using the `verifyWebhook()` helper.

## Pulse Monitor

Dashboard → Pulse → Enable for a form.

1. The monitor loads your deployed page.
2. It finds the form and submits a synthetic test.
3. It checks the ingestion API returns 202.
4. On failure, it opens an incident and sends alert emails.
5. On recovery, the incident auto-resolves.

Monitor interval: 5 minutes to 24 hours.

## Team management

Dashboard → Team → Invite.

Roles:
- **Viewer**: read-only access to forms, submissions, and health status.
- **Developer**: full technical access (forms, webhooks, API keys) but no bulk export or billing.
- **Admin**: everything except workspace deletion and billing management.
- **Owner**: full access including billing and workspace deletion.

You cannot invite someone to a role equal to or higher than your own.
