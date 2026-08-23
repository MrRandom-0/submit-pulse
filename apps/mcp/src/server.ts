/**
 * MCP server bootstrap.
 *
 * INCOMPLETE — MCP SDK not wired.
 * ================================
 * This module defines the transport interface and the tool registration
 * structure. The actual MCP SDK (`@modelcontextprotocol/sdk` or equivalent)
 * cannot be installed because npm is firewalled in this environment.
 *
 * TO COMPLETE:
 *   1. `npm install @modelcontextprotocol/sdk` (or the SDK of your choice).
 *   2. Replace `McpServerInterface` below with the real SDK's Server class.
 *   3. Replace the `INCOMPLETE` stub in `createMcpServer` with real registration.
 *   4. Wire the real token-verification path in auth.ts.
 *
 * The tool handlers in tools.ts and the auth model in auth.ts are complete
 * and do not need to change when the SDK is wired.
 */

import { verifyInstallationToken, McpAuthError } from "./auth.js";
import {
  TOOL_SCHEMAS,
  handleListForms,
  handleGetFormConfig,
  handleGetSchema,
  handleGenerateIntegration,
  handleValidateIntegration,
  handleSendTestSubmission,
  handleCheckFormHealth,
} from "./tools.js";

// ---------------------------------------------------------------------------
// Transport abstraction
// ---------------------------------------------------------------------------

/** Minimal interface the real MCP SDK server would satisfy. */
export interface McpServerInterface {
  /**
   * Register a tool with its JSON Schema and handler.
   * The real SDK validates inputs against the schema before calling handler.
   */
  registerTool(definition: ToolDefinition): void;

  /** Start listening on the chosen transport (stdio, HTTP, etc.). */
  listen(): Promise<void>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: unknown, meta: RequestMeta) => Promise<unknown>;
}

/** Per-request metadata the MCP runtime provides to handlers. */
export interface RequestMeta {
  /** The raw installation token string from the request. */
  token: string;
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

/**
 * Wire all tool handlers onto the provided MCP server instance.
 *
 * INCOMPLETE: Replace `McpServerInterface` parameter type with the real
 * SDK's `Server` class and pass in a real server instance.
 */
export function createMcpServer(server: McpServerInterface): McpServerInterface {
  /**
   * Shared token extraction and verification for all tool calls.
   * Throws McpAuthError if the token is missing or invalid.
   */
  async function withAuth<I, O>(
    meta: RequestMeta,
    fn: (token: Awaited<ReturnType<typeof verifyInstallationToken> & { ok: true }>["token"]) => Promise<O>,
  ): Promise<O> {
    const result = verifyInstallationToken(meta.token);
    if (!result.ok) {
      throw new McpAuthError(`Authentication failed: ${result.error}`);
    }
    return fn(result.token);
  }

  server.registerTool({
    name: "list_forms",
    description: "List forms accessible under this installation. Returns configuration metadata only — no submission content.",
    inputSchema: TOOL_SCHEMAS.list_forms,
    handler: (input, meta) =>
      withAuth(meta, (token) => handleListForms(token, input as Parameters<typeof handleListForms>[1])),
  });

  server.registerTool({
    name: "get_form_config",
    description:
      "Get configuration for a form (allowed origins, webhook status, etc.). Returns configuration only — NEVER submission content.",
    inputSchema: TOOL_SCHEMAS.get_form_config,
    handler: (input, meta) =>
      withAuth(meta, (token) => handleGetFormConfig(token, input as Parameters<typeof handleGetFormConfig>[1])),
  });

  server.registerTool({
    name: "get_schema",
    description:
      "Get the JSON Schema describing a form's accepted fields. Returns field definitions only — NEVER submission content.",
    inputSchema: TOOL_SCHEMAS.get_schema,
    handler: (input, meta) =>
      withAuth(meta, (token) => handleGetSchema(token, input as Parameters<typeof handleGetSchema>[1])),
  });

  server.registerTool({
    name: "generate_integration",
    description: "Generate a ready-to-paste code snippet for a specific AI builder or framework.",
    inputSchema: TOOL_SCHEMAS.generate_integration,
    handler: (input, meta) =>
      withAuth(meta, (token) => handleGenerateIntegration(token, input as Parameters<typeof handleGenerateIntegration>[1])),
  });

  server.registerTool({
    name: "validate_integration",
    description: "Statically validate a generated integration snippet against the form's configuration.",
    inputSchema: TOOL_SCHEMAS.validate_integration,
    handler: (input, meta) =>
      withAuth(meta, (token) => handleValidateIntegration(token, input as Parameters<typeof handleValidateIntegration>[1])),
  });

  server.registerTool({
    name: "send_test_submission",
    description: "Send a synthetic health-check submission (marked with the synthetic header). Excluded from analytics.",
    inputSchema: TOOL_SCHEMAS.send_test_submission,
    handler: (input, meta) =>
      withAuth(meta, (token) => handleSendTestSubmission(token, input as Parameters<typeof handleSendTestSubmission>[1])),
  });

  server.registerTool({
    name: "check_form_health",
    description: "Run configuration health checks on a form and return a pass/fail report.",
    inputSchema: TOOL_SCHEMAS.check_form_health,
    handler: (input, meta) =>
      withAuth(meta, (token) => handleCheckFormHealth(token, input as Parameters<typeof handleCheckFormHealth>[1])),
  });

  return server;
}
