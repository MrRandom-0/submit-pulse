/**
 * CENTRALISED AUTHORIZATION
 * =========================
 *
 * The spec is explicit: do not scatter role checks throughout components.
 * Every authorization question in the product resolves through `can()`.
 *
 * Design notes
 * ------------
 * 1. Permissions are named after ACTIONS ON RESOURCES, not after UI screens.
 *    UI code asks "may I do X" and renders accordingly; it never asks
 *    "is the user an admin".
 *
 * 2. The matrix is exhaustive by construction. `Permission` is a union, and
 *    each role must map every permission to a boolean — omitting one is a
 *    compile error, so adding a permission forces a deliberate decision for
 *    all four roles rather than defaulting to "allowed".
 *
 * 3. This module answers ROLE questions only. It is one of three layers:
 *      - this matrix        -> what a role may do
 *      - tenant scoping     -> which workspace's rows are visible
 *      - Row Level Security -> the database-level backstop
 *    A permission grant is never sufficient on its own; callers must still
 *    scope queries by workspace. RLS exists because this layer can be bypassed
 *    by a bug, and defence in depth assumes it eventually will be.
 */

export const WORKSPACE_ROLES = [
  "owner",
  "admin",
  "developer",
  "viewer",
] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PERMISSIONS = [
  // Forms
  "form:read",
  "form:create",
  "form:update",
  "form:delete",
  "form:pause",
  "form:test",

  // Submissions
  "submission:read",
  "submission:update", // status, tags, assignment, notes
  "submission:delete",
  "submission:export",
  "submission:restore_spam",

  // Files
  "file:download",

  // Delivery configuration
  "email_destination:manage",
  "autoresponder:manage",
  "webhook:manage",
  "webhook:replay",
  "integration:manage",

  // Health / AI
  "health:read",
  "health:manage",
  "incident:acknowledge",
  "schema_drift:resolve",
  "ai_repair:generate",
  "scanner:run",

  // Credentials
  "api_key:read",
  "api_key:create",
  "api_key:revoke",
  "agent_token:issue",

  // Workspace administration
  "workspace:read",
  "workspace:update",
  "workspace:delete",
  "member:read",
  "member:invite",
  "member:update_role",
  "member:remove",
  "audit_log:read",

  // Agency
  "client_workspace:create",
  "client_workspace:read",
  "client_workspace:manage",

  // Commercial
  "billing:read",
  "billing:manage",
  "usage:read",

  // Privacy
  "data:export_workspace",
  "data:configure_retention",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

type PermissionMatrix = Readonly<
  Record<WorkspaceRole, Readonly<Record<Permission, boolean>>>
>;

/** Helper: build a role row from its allowed permissions. */
const grant = (allowed: readonly Permission[]): Record<Permission, boolean> =>
  Object.fromEntries(PERMISSIONS.map((p) => [p, allowed.includes(p)])) as Record<
    Permission,
    boolean
  >;

const VIEWER: readonly Permission[] = [
  "form:read",
  "submission:read",
  "health:read",
  "workspace:read",
  "member:read",
  "usage:read",
  "client_workspace:read",
];

/**
 * Developer: full technical operation of forms and integrations, but no
 * commercial or membership authority, and no destructive workspace actions.
 * Deliberately CAN read submissions (needed to debug real payloads) but CANNOT
 * export them in bulk — bulk egress is an owner/admin decision.
 */
const DEVELOPER: readonly Permission[] = [
  ...VIEWER,
  "form:create",
  "form:update",
  "form:pause",
  "form:test",
  "submission:update",
  "submission:restore_spam",
  "file:download",
  "email_destination:manage",
  "autoresponder:manage",
  "webhook:manage",
  "webhook:replay",
  "integration:manage",
  "health:manage",
  "incident:acknowledge",
  "schema_drift:resolve",
  "ai_repair:generate",
  "scanner:run",
  "api_key:read",
  "api_key:create",
  "api_key:revoke",
  "agent_token:issue",
];

const ADMIN: readonly Permission[] = [
  ...DEVELOPER,
  "form:delete",
  "submission:delete",
  "submission:export",
  "workspace:update",
  "member:invite",
  "member:update_role",
  "member:remove",
  "audit_log:read",
  "client_workspace:create",
  "client_workspace:manage",
  "billing:read",
  "data:export_workspace",
  "data:configure_retention",
];

/** Owner adds the irreversible and commercial actions. */
const OWNER: readonly Permission[] = [
  ...ADMIN,
  "workspace:delete",
  "billing:manage",
];

export const PERMISSION_MATRIX: PermissionMatrix = {
  owner: grant(OWNER),
  admin: grant(ADMIN),
  developer: grant(DEVELOPER),
  viewer: grant(VIEWER),
};

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/** Resolved membership for the acting principal in one workspace. */
export interface Actor {
  readonly userId: string;
  readonly workspaceId: string;
  readonly role: WorkspaceRole;
  /** True for platform staff. Does NOT bypass workspace permissions. */
  readonly isPlatformAdmin?: boolean;
  /**
   * When the request is authenticated by a scoped credential (API key or
   * short-lived agent setup token) rather than a session, the credential's
   * scopes further restrict the role. Intersection semantics: the request is
   * allowed only if BOTH the role and the credential permit it.
   */
  readonly credentialScopes?: readonly Permission[];
}

/**
 * The single authorization entry point.
 *
 * Platform admins deliberately do NOT get implicit access to tenant data here.
 * Support access to customer content requires an explicit, audited escalation
 * (see docs/33-admin-guide.md) rather than an ambient superuser bit.
 */
export function can(actor: Actor, permission: Permission): boolean {
  const roleAllows = PERMISSION_MATRIX[actor.role][permission];
  if (!roleAllows) return false;

  if (actor.credentialScopes !== undefined) {
    return actor.credentialScopes.includes(permission);
  }
  return true;
}

/** Convenience: assert-style guard for server actions and route handlers. */
export class AuthorizationError extends Error {
  readonly code = "forbidden" as const;
  readonly permission: Permission;

  constructor(permission: Permission) {
    // Message is deliberately generic; callers must not leak resource existence.
    super("You do not have permission to perform this action.");
    this.name = "AuthorizationError";
    this.permission = permission;
  }
}

export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) throw new AuthorizationError(permission);
}

/** All permissions a role holds — useful for shipping a capability map to the client. */
export function permissionsForRole(role: WorkspaceRole): Permission[] {
  return PERMISSIONS.filter((p) => PERMISSION_MATRIX[role][p]);
}

/** Role comparison for "can this actor manage that member" style checks. */
const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  developer: 1,
  admin: 2,
  owner: 3,
};

/**
 * A member may only be assigned or modified by someone of strictly higher rank,
 * which prevents an admin from demoting an owner or escalating themselves.
 */
export function canManageMemberWithRole(
  actor: Actor,
  targetRole: WorkspaceRole,
): boolean {
  if (!can(actor, "member:update_role")) return false;
  return ROLE_RANK[actor.role] > ROLE_RANK[targetRole];
}

export function canAssignRole(actor: Actor, roleToAssign: WorkspaceRole): boolean {
  if (!can(actor, "member:update_role")) return false;
  // Cannot grant a role at or above your own.
  return ROLE_RANK[actor.role] > ROLE_RANK[roleToAssign];
}
