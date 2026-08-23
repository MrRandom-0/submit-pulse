/**
 * @submitpulse/mcp — entry point.
 *
 * INCOMPLETE — see server.ts for the MCP SDK wiring notes.
 *
 * When the MCP SDK is available:
 *   import { Server } from "@modelcontextprotocol/sdk/server/index.js";
 *   import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
 *   const server = new Server({ name: "submitpulse", version: "0.1.0" }, ...);
 *   createMcpServer(server);
 *   await server.connect(new StdioServerTransport());
 */

export { createMcpServer } from "./server.js";
export type { McpServerInterface, ToolDefinition, RequestMeta } from "./server.js";

export { SCOPES, verifyInstallationToken, requireScope, McpAuthError } from "./auth.js";
export type { InstallationToken, Scope, VerifyResult } from "./auth.js";

export { TOOL_SCHEMAS } from "./tools.js";
