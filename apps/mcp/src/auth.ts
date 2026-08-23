/**
 * Authentication model for the Submit Pulse MCP server.
 *
 * CREDENTIAL MODEL: Short-lived installation tokens only.
 * --------------------------------------------------------
 * There is deliberately NO permanent-credential path.
 * Tokens are:
 *  - Scoped to a specific installation (workspace + integration).
 *  - Short-lived (see TOKEN_TTL_SECONDS).
 *  - Revocable server-side at any time.
 *
 * This matches the submitpulse_setup token family from brand.identifiers.
 * An AI coding agent receives one during the setup flow and must complete
 * its task before the token expires. After setup, the agent's access is
 * revoked; the form endpoint itself is public (no credential needed for
 * submissions — domain rules and bot protection are the access controls).
 *
 * SCOPE DEFINITIONS:
 * These scopes are checked structurally in tool handlers. Any tool handler
 * that reads submission BODIES must refuse to do so — the listed scopes
 * only authorise configuration access.
 */

export const SCOPES = {
  /** Read form configuration and schema. Never includes submission content. */
  FORMS_READ: "forms:read",
  /** Generate integration snippets. Requires forms:read. */
  INTEGRATION_GENERATE: "integration:generate",
  /** Send synthetic health-check submissions. */
  HEALTH_CHECK: "health:check",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

/** Decoded installation token claims. */
export interface InstallationToken {
  /** Installation identifier. */
  installationId: string;
  /** Workspace the installation belongs to. */
  workspaceId: string;
  /** Scopes granted to this token. */
  scopes: readonly Scope[];
  /** Unix timestamp when this token expires. */
  expiresAt: number;
}

/** Result of token verification. */
export type VerifyResult =
  | { ok: true; token: InstallationToken }
  | { ok: false; error: string };

/**
 * Verify a raw installation token string.
 *
 * INCOMPLETE: The real implementation would call the Submit Pulse auth service
 * to validate the signed token, check revocation, and decode the claims.
 * Here we return a structured error to prevent any code path from proceeding
 * with an unverified credential.
 */
export function verifyInstallationToken(_raw: string): VerifyResult {
  // INCOMPLETE — requires @submitpulse/auth service integration.
  return {
    ok: false,
    error:
      "Token verification is not implemented. Wire the auth service here.",
  };
}

/** Assert that a token has the required scope; throws if not. */
export function requireScope(
  token: InstallationToken,
  scope: Scope,
): void {
  if (!token.scopes.includes(scope)) {
    throw new McpAuthError(
      `Insufficient scope: '${scope}' is required but not granted to this token.`,
    );
  }
}

export class McpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpAuthError";
  }
}
