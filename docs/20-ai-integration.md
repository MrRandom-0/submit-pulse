# 20 — AI Integration

Source: `packages/config/src/integration-prompts.ts`, `packages/config/src/snippets.ts`, `packages/config/src/builders.ts`

## What AI integration means here

Submit Pulse does not call out to an LLM for its own operations (at the time this documentation was written). "AI integration" refers to the product's primary differentiated feature: generating prompts that a user pastes into an AI coding tool (Lovable, Bolt, Claude Code, Cursor, etc.) to wire up a form.

The `aiRepair` feature uses a generated prompt for schema drift repair, again delivered to a human who pastes it into their AI tool.

Future AI-powered features described in the schema (spam analysis via `ai_analyses_per_month` quota, AI repair prompt generation via the worker) are stubs.

## Builder registry

`packages/config/src/builders.ts` defines 17 builder profiles:

| Category | Builders |
|---|---|
| AI builder | Lovable, Bolt, v0, Replit |
| AI IDE | Cursor, Claude Code, Codex, Windsurf |
| Framework | Next.js, React, Vue, Svelte, Astro |
| Visual editor | Framer, Webflow |
| Other | Static HTML, Other |

Each profile declares:
- `surface`: `chat_agent`, `ide_agent`, `visual_editor`, or `manual`. Determines prompt framing.
- `hasEnvVars`: whether the platform supports environment variables. Affects the security note in the prompt.
- `understandsRepoWideInstruction`: whether the agent sees the whole project or only the open file. When false, the prompt instructs the user to open the specific file before pasting.
- `snippetFlavour`: which code snippet to embed.
- `caveats`: builder-specific notes appended to the prompt.

## Integration prompt generation

`generateIntegrationPrompt(ctx: PromptContext)` produces a complete prompt.

`PromptContext` fields:
- `formName`: human-readable form name.
- `publicFormId`: the `fm_xxx` identifier.
- `endpoint`: the full submission URL.
- `fields`: ordered array of field specs (name, type, required, label).
- `allowedOrigin`: the CORS origin (or null).
- `captchaEnabled`: whether Turnstile is required.
- `hasFileUpload`: whether multipart/form-data is needed.
- `builder`: the builder ID.

**Security invariant** (from the module comment): "`PromptContext` intentionally omits: `apiKey`, `managementKey`, `sessionToken`, `installationToken`, and any other credential. The endpoint URL is public by design; no secret is needed or permitted in a generated prompt."

The prompt includes:
1. Task description: wire the form to the endpoint without redesigning it.
2. Scope note (when agent sees only the open file).
3. Endpoint URL.
4. Field schema with exact names and types.
5. Allowed origin warning.
6. CAPTCHA instructions (when enabled).
7. File upload note (when enabled).
8. Security note (no credentials needed or permitted).
9. Nine implementation requirements (loading state, accessible validation, error handling, success state, duplicate prevention, etc.).
10. Builder-specific caveats.
11. Reference code snippet.

## Code snippet generation

`generateSnippet(input: SnippetInput)` in `packages/config/src/snippets.ts` generates framework-specific code.

Supported flavours: `react`, `nextjs`, `vue`, `svelte`, `astro`, `html`, `none`.

Every generated snippet:
- Uses `fetch()` with `POST` method.
- Handles JSON and multipart/form-data based on whether the form has file uploads.
- Includes a loading state (disables submit button while in-flight).
- Includes client-side validation with `aria-invalid` and `aria-describedby`.
- Reads the API's structured error shape `{ error?: string; message?: string }`.
- Shows a success state after 2xx.
- Guards against duplicate submissions with an in-flight flag.
- Optionally loads the Turnstile script and renders the widget.

The snippet never includes API keys, session tokens, or any credential. A comment in every generated file states: "SECURITY: No API key is needed or accepted."

## Visual editor instructions

For Framer and Webflow (`surface: 'visual_editor'`), `generateIntegrationPrompt()` returns configuration instructions rather than a coding prompt. The instructions tell the user to set the form action URL in the editor UI and ensure field names match the schema.

## Repair prompt

`generateRepairPrompt(ctx)` generates a focused prompt for fixing a specific field name mismatch. It targets only the affected field and instructs the agent not to touch anything else.

## Scanner fix prompt

`generateScannerFixPrompt(ctx)` generates a prompt for fixing a specific issue found by the website scanner (e.g. missing ARIA labels, broken form action URLs).

## Installation token (AI agent setup)

`installation_tokens` are short-lived credentials issued to an AI coding agent during the onboarding setup wizard. The agent uses the token to:
- Read the form's field schema.
- Generate a test submission.
- Validate that the integration resolves correctly.

The token must never grant access to submission data, billing, or membership. Scope is enforced by the `credentialScopes` field on the `Actor` (intersection semantics with the workspace role).

Token issuance requires `agent_token:issue` permission (developer role and above).
