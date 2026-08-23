/**
 * Internal module: exposes getProvider() for route handlers that need direct
 * provider access (e.g. the OAuth callback route).
 *
 * Do NOT add this to index.ts. Route handlers that call the provider directly
 * must import from here explicitly, making the dependency visible.
 *
 * Application code should prefer the session helper functions (getSession,
 * requireSession, etc.) from session.ts, which handle the provider lifecycle.
 *
 * The provider singleton is managed exclusively in session.ts. This module
 * re-exports setProvider so instrumentation.ts has one clear setup path, and
 * provides a getProvider() that reads the same singleton via a shared reference.
 *
 * INCOMPLETE: The dual-export approach (session.ts + this file) is temporary.
 * Once instrumentation.ts is wired, route handlers can call getSession() from
 * session.ts directly and this file can be removed.
 */

export { setProvider, getSession, requireSession, getActor, requireActor } from "./session";

/**
 * getProvider is not currently exposed here because it would require
 * re-exporting the private singleton from session.ts. Route handlers that
 * need the raw provider should call getSession() instead.
 *
 * If a route handler truly needs the raw provider (e.g. OAuth code exchange),
 * it should call getSession() first to confirm auth context, then use the
 * provider through the session helper.
 *
 * See apps/web/src/app/(auth)/auth/callback/route.ts for the OAuth handler.
 */
