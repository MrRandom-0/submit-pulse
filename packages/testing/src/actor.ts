/**
 * makeActor — construct an Actor for use in permission and authorization tests.
 *
 * The Actor interface is defined in @submitpulse/auth/permissions.
 * Import real types from there; never redefine them here.
 */

import type { Actor, WorkspaceRole, Permission } from "@submitpulse/auth/permissions";

export interface MakeActorOptions {
  /** Defaults to a deterministic fake UUID. */
  userId?: string;
  /** Defaults to a deterministic fake UUID. */
  workspaceId?: string;
  /** Whether the actor is a platform admin. Does NOT bypass workspace permissions. */
  isPlatformAdmin?: boolean;
  /**
   * When set, the actor is authenticated via a scoped credential (API key or
   * agent token) and can only perform actions in the intersection of their role
   * permissions and these scopes.
   */
  credentialScopes?: readonly Permission[];
}

let _actorCounter = 0;

/**
 * Build an Actor fixture for a given workspace role.
 *
 * @example
 *   const owner = makeActor("owner");
 *   const viewer = makeActor("viewer", { workspaceId: "same-ws" });
 */
export function makeActor(
  role: WorkspaceRole,
  options: MakeActorOptions = {},
): Actor {
  const n = ++_actorCounter;
  return {
    userId: options.userId ?? `user-${n.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`,
    workspaceId:
      options.workspaceId ??
      `ws-${n.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`,
    role,
    isPlatformAdmin: options.isPlatformAdmin ?? false,
    credentialScopes: options.credentialScopes,
  };
}
