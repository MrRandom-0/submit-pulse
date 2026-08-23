/**
 * Server-side session helpers for Next.js App Router (React Server Components
 * and Server Actions).
 *
 * AUTHORIZATION ARCHITECTURE NOTE
 * ================================
 * Authorization decisions ALWAYS route through permissions.ts (can() and
 * assertCan()). This is enforced server-side even when the UI has already
 * hidden a control based on the actor's role. Hiding a control is a UX
 * nicety — the server-side check is the actual enforcement boundary.
 *
 * A compromised client cannot bypass permission checks by directly calling
 * a Server Action or Route Handler, because those re-derive the Actor from
 * the session and re-run can() before touching any data.
 *
 * INCOMPLETE: This module contains stub implementations. The concrete
 * provider is imported from a singleton that must be initialised before
 * use (see getProvider()). The database query in getActor() requires
 * the database client to be available via the app's DB singleton —
 * wire this in once the database package exposes a server-side client.
 */

import { redirect } from "next/navigation";

import { can, AuthorizationError, type Actor, type Permission } from "./permissions";
import type { AuthProvider, AuthSession } from "./provider";

/* -------------------------------------------------------------------------- */
/* Provider singleton                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Module-level provider slot. The application initialises this once at
 * startup (e.g. in instrumentation.ts or a top-level server module) by
 * calling setProvider(). All session helpers then use the singleton.
 *
 * Using a module-level singleton (rather than constructing per-request)
 * avoids repeated validation of env vars and allows connection pooling
 * inside the provider implementation.
 */
let _provider: AuthProvider | null = null;

export function setProvider(provider: AuthProvider): void {
  if (_provider !== null) {
    // Allow re-initialisation in tests but warn in production.
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("[session] Provider is already initialised.");
    }
  }
  _provider = provider;
}

function getProvider(): AuthProvider {
  if (!_provider) {
    throw new Error(
      "[session] AuthProvider is not initialised. Call setProvider() before " +
        "using session helpers. In Next.js, do this in instrumentation.ts.",
    );
  }
  return _provider;
}

/* -------------------------------------------------------------------------- */
/* WorkspaceMembership lookup                                                  */
/* -------------------------------------------------------------------------- */

/**
 * INCOMPLETE: Real implementation queries workspace_members joined with users
 * to resolve the actor's role for a given workspace. This requires the Drizzle
 * database client from @submitpulse/database to be injectable here.
 *
 * Until that is wired, this function returns null so that requireActor()
 * correctly redirects unauthenticated / unauthorised requests.
 *
 * Wire pattern:
 *   import { db } from "@submitpulse/database/client";
 *   import { workspaceMembers, users } from "@submitpulse/database/schema";
 *   import { eq, and } from "drizzle-orm";
 *
 *   const [row] = await db
 *     .select({ role: workspaceMembers.role, isPlatformAdmin: users.isPlatformAdmin })
 *     .from(workspaceMembers)
 *     .innerJoin(users, eq(users.id, workspaceMembers.userId))
 *     .where(
 *       and(
 *         eq(workspaceMembers.userId, session.userId),
 *         eq(workspaceMembers.workspaceId, workspaceId),
 *       ),
 *     )
 *     .limit(1);
 */
async function resolveMembership(
  _session: AuthSession,
  _workspaceId: string,
): Promise<{ role: Actor["role"]; isPlatformAdmin: boolean } | null> {
  // INCOMPLETE: replace with real DB query (see comment above).
  return null;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Return the current session, or null if the user is not authenticated.
 * Never throws. Safe to call in any Server Component or Server Action.
 */
export async function getSession(): Promise<AuthSession | null> {
  const result = await getProvider().getSession();
  if (!result.ok) return null;
  return result.data;
}

/**
 * Return the current session, or redirect to /login with a `next` param.
 *
 * Usage:
 *   const session = await requireSession(); // throws a redirect if unauthenticated
 *
 * The redirect preserves the current URL so the login page can return the
 * user to their intended destination after authentication.
 *
 * NOTE: next/navigation's redirect() throws a special Next.js error value —
 * this function never "returns" in the unauthenticated path.
 */
export async function requireSession(
  /**
   * The URL to redirect to after login. Defaults to the current request URL.
   * Pass explicitly from route handlers or page components.
   */
  nextUrl?: string,
): Promise<AuthSession> {
  const session = await getSession();

  if (!session) {
    const loginUrl = nextUrl
      ? `/login?next=${encodeURIComponent(nextUrl)}`
      : "/login";
    redirect(loginUrl);
  }

  return session;
}

/**
 * Resolve the Actor for a given workspace and the currently authenticated user.
 *
 * Returns null if:
 * - The user is not authenticated.
 * - The user is not a member of the workspace.
 *
 * Authorization decisions (can()) MUST be made against the Actor returned
 * here, not against a session directly, because the Actor carries the workspace-
 * scoped role. A user may have different roles in different workspaces.
 */
export async function getActor(workspaceId: string): Promise<Actor | null> {
  const session = await getSession();
  if (!session) return null;

  const membership = await resolveMembership(session, workspaceId);
  if (!membership) return null;

  return {
    userId: session.userId,
    workspaceId,
    role: membership.role,
    isPlatformAdmin: membership.isPlatformAdmin,
  };
}

/**
 * Resolve the Actor and assert a permission, redirecting or throwing otherwise.
 *
 * AUTHORIZATION ENFORCEMENT NOTE: This is the primary server-side enforcement
 * point. Call it at the top of every Server Action and Route Handler that
 * touches workspace-scoped data. The UI may already hide the triggering
 * control (via PermissionGate or a client-side can() check), but the server-
 * side check here is the actual enforcement — do not skip it.
 *
 * Throws AuthorizationError (which callers can catch if they need to handle
 * 403 explicitly) or redirects to /login for unauthenticated users.
 *
 * Usage:
 *   const actor = await requireActor(workspaceId, "form:create");
 *   // actor is guaranteed non-null here and has the permission
 */
export async function requireActor(
  workspaceId: string,
  permission: Permission,
): Promise<Actor> {
  const session = await getSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/overview`)}`);
  }

  const actor = await getActor(workspaceId);

  if (!actor) {
    // Not a member of this workspace — treat as 403, not 404, to avoid
    // leaking workspace existence.
    throw new AuthorizationError(permission);
  }

  if (!can(actor, permission)) {
    throw new AuthorizationError(permission);
  }

  return actor;
}
