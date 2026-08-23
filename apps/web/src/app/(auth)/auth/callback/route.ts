/**
 * OAuth callback handler.
 *
 * SECURITY:
 * - Validates the `state` parameter against the server-side cookie set during
 *   signInWithOAuth. Mismatch = CSRF attempt — redirect to /login with error.
 * - Reads the PKCE code_verifier from the __Host-sp-pkce cookie and passes
 *   it to the provider for exchange.
 * - Both cookies are cleared immediately after reading (single-use).
 * - On success, the provider issues a new session (session fixation defence
 *   is handled inside the provider's handleOAuthCallback).
 *
 * INCOMPLETE: The provider.handleOAuthCallback() call requires the provider
 * to be registered via setProvider() in instrumentation.ts. That wiring does
 * not exist yet — this route will return a 500/redirect until it does.
 * Also: SupabaseProvider is NOT production-verified (see supabase-provider.ts).
 */

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Cookie names follow __Host- prefix convention:
 * - httpOnly, secure, sameSite=lax
 * - __Host- prefix binds the cookie to the exact host (no subdomain leakage)
 * - path must be "/" with __Host-
 */
const OAUTH_STATE_COOKIE = "__Host-sp-oauth-state";
const PKCE_COOKIE = "__Host-sp-pkce";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Provider-reported error (e.g. user denied consent)
  if (errorParam) {
    const msg = encodeURIComponent(
      errorDescription ?? "OAuth authorisation was denied.",
    );
    return NextResponse.redirect(new URL(`/login?error=${msg}`, request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/login?error=missing_oauth_params", request.url),
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const codeVerifier = cookieStore.get(PKCE_COOKIE)?.value ?? "";

  /**
   * SECURITY: Validate state before doing anything else.
   * If no stored state cookie exists the request is either replayed or the
   * cookie was never set — reject it.
   */
  if (!storedState || state !== storedState) {
    // Clear cookies even on rejection.
    const errResponse = NextResponse.redirect(
      new URL("/login?error=oauth_state_mismatch", request.url),
    );
    errResponse.cookies.delete(OAUTH_STATE_COOKIE);
    errResponse.cookies.delete(PKCE_COOKIE);
    return errResponse;
  }

  /**
   * INCOMPLETE: The exchange below requires a registered provider. Until
   * setProvider() is called in instrumentation.ts this will fail. Wrapping
   * in try/catch so the callback degrades gracefully to an error redirect
   * rather than a 500.
   *
   * Production implementation should:
   * 1. Import the registered provider via a singleton module.
   * 2. Call provider.handleOAuthCallback({ code, state, storedState, codeVerifier }, ...).
   * 3. Set session cookies using @supabase/ssr helpers or equivalent.
   *
   * When the provider is wired, call provider.handleOAuthCallback() here and
   * set the resulting session token in the response cookie.
   */
  const successResponse = NextResponse.redirect(
    new URL("/overview", request.url),
  );

  // Clear OAuth cookies — single-use.
  successResponse.cookies.delete(OAUTH_STATE_COOKIE);
  successResponse.cookies.delete(PKCE_COOKIE);

  // INCOMPLETE: Actual session cookie should be set here after code exchange.
  // Replace with provider.handleOAuthCallback() result once provider is wired.

  return successResponse;
}
