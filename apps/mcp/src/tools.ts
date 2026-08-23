/**
 * MCP tool definitions: JSON Schema + typed handlers.
 *
 * CRITICAL PERMISSION RULE — enforced structurally, not just by convention:
 * ===========================================================================
 * Standard installation scopes MUST NOT expose customer submission content.
 * get_form_config and get_schema return configuration metadata only.
 * NO handler in this file has a code path that reads submission bodies.
 * The API layer that these handlers would call is configuration-only.
 * Any future tool that might return submission content MUST:
 *   1. Define a dedicated scope (e.g. "submissions:read") — not yet defined.
 *   2. Require explicit user consent beyond the standard setup flow.
 *   3. Be reviewed separately for data-handling compliance.
 * ===========================================================================
 */

import { brand, formEndpoint, BUILDERS } from "@submitpulse/config";
import { SCOPES, requireScope } from "./auth.js";
import type { InstallationToken } from "./auth.js";
import type {
  CheckFormHealthInput,
  FormConfig,
  FormHealthResult,
  FormSchema,
  FormSummary,
  GenerateIntegrationInput,
  GetFormConfigInput,
  GetSchemaInput,
  IntegrationResult,
  ListFormsInput,
  SendTestSubmissionInput,
  TestSubmissionResult,
  ValidateIntegrationInput,
  ValidationResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// JSON Schema definitions for tool inputs (used by the MCP SDK for validation)
// ---------------------------------------------------------------------------

export const TOOL_SCHEMAS = {
  list_forms: {
    type: "object" as const,
    properties: {
      workspaceId: { type: "string", description: "Filter to a specific workspace." },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      cursor: { type: "string", description: "Pagination cursor from a previous response." },
    },
    additionalProperties: false,
  },

  get_form_config: {
    type: "object" as const,
    required: ["formId"],
    properties: {
      formId: { type: "string", pattern: "^fm_" },
    },
    additionalProperties: false,
  },

  get_schema: {
    type: "object" as const,
    required: ["formId"],
    properties: {
      formId: { type: "string", pattern: "^fm_" },
    },
    additionalProperties: false,
  },

  generate_integration: {
    type: "object" as const,
    required: ["formId", "builderId"],
    properties: {
      formId: { type: "string", pattern: "^fm_" },
      builderId: {
        type: "string",
        enum: Object.keys(BUILDERS),
        description: "Which AI builder or framework to generate the snippet for.",
      },
    },
    additionalProperties: false,
  },

  validate_integration: {
    type: "object" as const,
    required: ["formId", "code", "builderId"],
    properties: {
      formId: { type: "string", pattern: "^fm_" },
      code: { type: "string", minLength: 1 },
      builderId: { type: "string", enum: Object.keys(BUILDERS) },
    },
    additionalProperties: false,
  },

  send_test_submission: {
    type: "object" as const,
    required: ["formId", "fields"],
    properties: {
      formId: { type: "string", pattern: "^fm_" },
      fields: {
        type: "object",
        additionalProperties: { type: "string" },
        description: "Field values for the synthetic submission.",
      },
    },
    additionalProperties: false,
  },

  check_form_health: {
    type: "object" as const,
    required: ["formId"],
    properties: {
      formId: { type: "string", pattern: "^fm_" },
    },
    additionalProperties: false,
  },
} as const;

// ---------------------------------------------------------------------------
// Tool handler implementations
//
// Each handler is a pure function of (token, input) -> output.
// The actual API calls are marked INCOMPLETE; they would use the
// installation token to call the Submit Pulse internal API.
// ---------------------------------------------------------------------------

/**
 * list_forms — list forms accessible under the token's installation.
 * Returns configuration metadata only. No submission content.
 */
export async function handleListForms(
  token: InstallationToken,
  input: ListFormsInput,
): Promise<{ forms: FormSummary[]; nextCursor?: string }> {
  requireScope(token, SCOPES.FORMS_READ);

  // INCOMPLETE: call Submit Pulse internal API:
  // GET /internal/v1/installations/{token.installationId}/forms
  // Query: workspaceId, limit, cursor
  // Returns: { forms: FormSummary[], nextCursor?: string }
  void input;
  throw new Error(
    "list_forms handler is INCOMPLETE — API client not wired.",
  );
}

/**
 * get_form_config — returns form configuration only.
 *
 * CRITICAL: This handler MUST NOT return submission content.
 * It calls a configuration-only endpoint. There is no code path
 * to submission data from this handler.
 */
export async function handleGetFormConfig(
  token: InstallationToken,
  input: GetFormConfigInput,
): Promise<FormConfig> {
  requireScope(token, SCOPES.FORMS_READ);

  // INCOMPLETE: call Submit Pulse internal API:
  // GET /internal/v1/forms/{input.formId}/config
  // Returns: FormConfig (configuration only — no submission bodies)
  void input;
  throw new Error(
    "get_form_config handler is INCOMPLETE — API client not wired.",
  );
}

/**
 * get_schema — returns the JSON Schema for accepted fields.
 *
 * CRITICAL: This handler MUST NOT return submission content.
 * Schema describes what fields a form accepts; it contains zero submission data.
 */
export async function handleGetSchema(
  token: InstallationToken,
  input: GetSchemaInput,
): Promise<FormSchema> {
  requireScope(token, SCOPES.FORMS_READ);

  // INCOMPLETE: call Submit Pulse internal API:
  // GET /internal/v1/forms/{input.formId}/schema
  // Returns: FormSchema (field definitions only — no submission bodies)
  void input;
  throw new Error(
    "get_schema handler is INCOMPLETE — API client not wired.",
  );
}

/**
 * generate_integration — produce a ready-to-paste code snippet.
 * Uses static builder profiles and the canonical endpoint URL; no API call required.
 */
export async function handleGenerateIntegration(
  token: InstallationToken,
  input: GenerateIntegrationInput,
): Promise<IntegrationResult> {
  requireScope(token, SCOPES.FORMS_READ);
  requireScope(token, SCOPES.INTEGRATION_GENERATE);

  const builder = BUILDERS[input.builderId];
  const endpoint = formEndpoint(input.formId);

  // Generate a snippet appropriate for the builder's snippet flavour.
  // This is a basic template; a real implementation would have richer templates.
  const snippet = buildSnippet(input.formId, endpoint, builder.snippetFlavour);

  return {
    formId: input.formId,
    builderId: input.builderId,
    snippet,
    caveats: builder.caveats,
  };
}

/**
 * validate_integration — static analysis of a generated snippet.
 * Checks for the correct endpoint, required headers, etc.
 */
export async function handleValidateIntegration(
  token: InstallationToken,
  input: ValidateIntegrationInput,
): Promise<ValidationResult> {
  requireScope(token, SCOPES.FORMS_READ);

  const issues: ValidationResult["issues"] = [];
  const expectedEndpoint = formEndpoint(input.formId);

  if (!input.code.includes(expectedEndpoint)) {
    issues.push({
      severity: "error",
      message: `Snippet does not reference the correct endpoint: ${expectedEndpoint}`,
    });
  }

  if (!input.code.includes(brand.wire.requestIdHeader)) {
    // Not an error — just a best-practice warning.
    issues.push({
      severity: "warning",
      message: `Consider reading the ${brand.wire.requestIdHeader} header from the response for tracing.`,
    });
  }

  return { valid: issues.filter((i) => i.severity === "error").length === 0, issues };
}

/**
 * send_test_submission — POST a synthetic submission marked with the synthetic header.
 * The synthetic header causes the API to exclude this from analytics dashboards.
 */
export async function handleSendTestSubmission(
  token: InstallationToken,
  input: SendTestSubmissionInput,
): Promise<TestSubmissionResult> {
  requireScope(token, SCOPES.HEALTH_CHECK);

  const endpoint = formEndpoint(input.formId);

  // The synthetic header tells the server to flag this as a health-check
  // submission so it is excluded from analytics and notification flows.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [brand.wire.syntheticHeader]: "1",
    "User-Agent": brand.wire.userAgent,
    Authorization: `Bearer ${token.installationId}`, // INCOMPLETE: real token serialisation
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(input.fields),
    });
  } catch (err) {
    throw new Error(
      `Test submission network failure: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    accepted: response.ok,
    statusCode: response.status,
    requestId: response.headers.get(brand.wire.requestIdHeader) ?? undefined,
  };
}

/**
 * check_form_health — run a set of configuration health checks.
 */
export async function handleCheckFormHealth(
  token: InstallationToken,
  input: CheckFormHealthInput,
): Promise<FormHealthResult> {
  requireScope(token, SCOPES.FORMS_READ);
  requireScope(token, SCOPES.HEALTH_CHECK);

  // INCOMPLETE: fetch config then derive health checks from it.
  // Stub structure shows what checks would be performed.
  void input;
  throw new Error(
    "check_form_health handler is INCOMPLETE — API client not wired.",
  );
}

// ---------------------------------------------------------------------------
// Internal snippet builder (no API call; purely static)
// ---------------------------------------------------------------------------

function buildSnippet(
  formId: string,
  endpoint: string,
  flavour: string,
): string {
  switch (flavour) {
    case "react":
    case "nextjs":
      return `// ${brand.name} integration — generated for form ${formId}
import { createClient } from "${brand.packages.browser}";

const client = createClient({ publicFormId: "${formId}" });
// endpoint: ${endpoint}

export async function submitForm(data: Record<string, unknown>) {
  return client.submit(data);
}`;

    case "html":
      return `<!-- ${brand.name} integration — generated for form ${formId} -->
<form id="sp-form">
  <!-- add your fields here -->
  <button type="submit">Send</button>
</form>
<script type="module">
  document.getElementById("sp-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res = await fetch("${endpoint}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) console.log("Submitted!");
  });
</script>`;

    default:
      return `// ${brand.name} endpoint for form ${formId}: ${endpoint}
// POST JSON with your field values.`;
  }
}
