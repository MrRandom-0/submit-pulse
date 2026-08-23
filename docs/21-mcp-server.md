# 21 — MCP Server

## Status

The MCP server exists as a working TypeScript package at `apps/mcp/src/`. It is **not yet wired to a live API client** — every handler that requires a network call throws `"INCOMPLETE — API client not wired."` All type definitions, JSON Schema inputs, scope checks, and the snippet-generation handler are complete.

The `mcpServer` feature flag in `packages/config/src/entitlements.ts` gates access to Pro and Agency plans.

---

## Credential model

The server uses **short-lived installation tokens only**. There is no permanent-credential path. Tokens are:

- Scoped to a specific `installationId` (workspace + integration pair).
- Short-lived, with a hard `expiresAt` enforced server-side.
- Revocable at any time via the platform API.
- Single-use-friendly (default `maxUses: 10` in the database schema).

A token is issued to an AI coding agent during the setup flow. Once the agent has completed integration, the token expires and is not renewed. The form endpoint itself requires no credential — domain rules and bot protection are its access controls.

Token shape (`InstallationToken` in `apps/mcp/src/auth.ts`):

```typescript
interface InstallationToken {
  installationId: string;
  workspaceId:    string;
  scopes:         readonly Scope[];
  expiresAt:      number; // Unix timestamp
}
```

### Defined scopes

| Scope | Constant | Purpose |
|---|---|---|
| `forms:read` | `SCOPES.FORMS_READ` | Read form configuration and field schema. Never includes submission bodies. |
| `integration:generate` | `SCOPES.INTEGRATION_GENERATE` | Generate code snippets. Requires `forms:read`. |
| `health:check` | `SCOPES.HEALTH_CHECK` | Send synthetic test submissions marked with `x-submitpulse-synthetic: 1`. |

**Hard rule from `apps/mcp/src/tools.ts`**: standard installation scopes must not expose customer submission content. No handler in the file has a code path that reads submission bodies. Any future tool that might return submission content must define a dedicated scope (e.g. `submissions:read`, not yet defined), require explicit consent beyond the standard setup flow, and undergo separate data-handling review.

Scope enforcement is structural, not advisory: every handler calls `requireScope(token, SCOPES.X)` before any logic runs, and `requireScope` throws `McpAuthError` on mismatch.

---

## The 7 tools

### `list_forms`

Lists forms accessible under the token's installation. Returns configuration metadata only — no submission content.

**Required scope**: `forms:read`

**JSON Schema input**:

```json
{
  "type": "object",
  "properties": {
    "workspaceId": { "type": "string", "description": "Filter to a specific workspace." },
    "limit":       { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 },
    "cursor":      { "type": "string", "description": "Pagination cursor from a previous response." }
  },
  "additionalProperties": false
}
```

**Status**: INCOMPLETE — internal API call not wired (`GET /internal/v1/installations/{installationId}/forms`).

---

### `get_form_config`

Returns the configuration for a single form: name, allowed origins, notification destinations, field list, and settings. Calls a configuration-only endpoint; there is no code path to submission data.

**Required scope**: `forms:read`

**JSON Schema input**:

```json
{
  "type": "object",
  "required": ["formId"],
  "properties": {
    "formId": { "type": "string", "pattern": "^fm_" }
  },
  "additionalProperties": false
}
```

**Status**: INCOMPLETE — internal API call not wired (`GET /internal/v1/forms/{formId}/config`).

---

### `get_schema`

Returns the JSON Schema describing the fields a form accepts: field names, types, required flags, sensitive flags. Contains zero submission data.

**Required scope**: `forms:read`

**JSON Schema input**:

```json
{
  "type": "object",
  "required": ["formId"],
  "properties": {
    "formId": { "type": "string", "pattern": "^fm_" }
  },
  "additionalProperties": false
}
```

**Status**: INCOMPLETE — internal API call not wired (`GET /internal/v1/forms/{formId}/schema`).

---

### `generate_integration`

Produces a ready-to-paste code snippet for a specific AI builder or framework. Uses static builder profiles from `packages/config/src/builders.ts` and the canonical endpoint URL from `formEndpoint()` in `packages/config/src/brand.ts`. **No API call required** — this handler is fully functional as written.

**Required scopes**: `forms:read`, `integration:generate`

**JSON Schema input**:

```json
{
  "type": "object",
  "required": ["formId", "builderId"],
  "properties": {
    "formId":    { "type": "string", "pattern": "^fm_" },
    "builderId": {
      "type": "string",
      "enum": ["lovable", "bolt", "v0", "cursor", "claude-code", "codex", "replit", "nextjs", "html", "generic"],
      "description": "Which AI builder or framework to generate the snippet for."
    }
  },
  "additionalProperties": false
}
```

**Returns**:

```typescript
{
  formId:    string;
  builderId: string;
  snippet:   string;   // ready-to-paste code
  caveats?:  string;   // builder-specific warnings from the builder registry
}
```

Snippet flavour is determined by `BUILDERS[builderId].snippetFlavour`. The three flavours are `react`/`nextjs` (TypeScript import of `@submitpulse/browser`), `html` (vanilla JS with `fetch`), and a generic fallback (endpoint URL comment).

**Status**: Fully implemented.

---

### `validate_integration`

Static analysis of a generated snippet. Checks that it references the correct endpoint and optionally warns about missing `x-submitpulse-request-id` header reads. Does not send network requests.

**Required scope**: `forms:read`

**JSON Schema input**:

```json
{
  "type": "object",
  "required": ["formId", "code", "builderId"],
  "properties": {
    "formId":    { "type": "string", "pattern": "^fm_" },
    "code":      { "type": "string", "minLength": 1 },
    "builderId": { "type": "string", "enum": ["lovable", "bolt", "v0", "cursor", "claude-code", "codex", "replit", "nextjs", "html", "generic"] }
  },
  "additionalProperties": false
}
```

**Returns**:

```typescript
{
  valid:  boolean;
  issues: Array<{
    severity: "error" | "warning";
    message:  string;
  }>;
}
```

A snippet is `valid` when no `"error"`-severity issues exist. Warnings do not affect validity. Current checks: (1) correct endpoint URL present in code, (2) presence of `x-submitpulse-request-id` header handling (warning only).

**Status**: Fully implemented.

---

### `send_test_submission`

POSTs a synthetic submission to the live ingestion endpoint with the `x-submitpulse-synthetic: 1` header. The server excludes synthetic submissions from analytics dashboards and notification flows. **This handler makes a real network call.**

**Required scope**: `health:check`

**JSON Schema input**:

```json
{
  "type": "object",
  "required": ["formId", "fields"],
  "properties": {
    "formId": { "type": "string", "pattern": "^fm_" },
    "fields": {
      "type": "object",
      "additionalProperties": { "type": "string" },
      "description": "Field name/value pairs for the synthetic submission."
    }
  },
  "additionalProperties": false
}
```

**Returns**:

```typescript
{
  accepted:   boolean;   // true when the API returned 2xx
  statusCode: number;
  requestId?: string;    // x-submitpulse-request-id from the response
}
```

Request headers sent: `Content-Type: application/json`, `x-submitpulse-synthetic: 1`, `User-Agent: SubmitPulse/1.0 (+https://submitpulse.com/bot)`, `Authorization: Bearer {installationId}`.

**Status**: Network call implemented. Token serialisation is marked INCOMPLETE — real token encoding not wired.

---

### `check_form_health`

Runs a set of configuration health checks against a form: reachability, schema validity, origin configuration, notification delivery. Intended to aggregate results from multiple API calls.

**Required scopes**: `forms:read`, `health:check`

**JSON Schema input**:

```json
{
  "type": "object",
  "required": ["formId"],
  "properties": {
    "formId": { "type": "string", "pattern": "^fm_" }
  },
  "additionalProperties": false
}
```

**Status**: INCOMPLETE — stub. Throws `"check_form_health handler is INCOMPLETE — API client not wired."` The handler structure (scope checks, input validation) is in place.

---

## Server transport

`apps/mcp/src/server.ts` configures the MCP SDK server instance. `apps/mcp/src/index.ts` is the entry point. The server runs over stdio transport (standard MCP convention for local agent installation).

## Plan gating

| Plan | MCP server access |
|---|---|
| Free | No |
| Starter | No |
| Pro | Yes |
| Agency | Yes |

The `mcpServer` feature key is checked via `canUseFeature(ctx, "mcpServer")` from `packages/config/src/entitlements.ts`.
