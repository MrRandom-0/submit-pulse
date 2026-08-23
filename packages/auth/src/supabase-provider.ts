/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 * =====================================
 * This file implements the Supabase Auth driver for AuthProvider.
 *
 * STATUS: The call shapes are correct for @supabase/supabase-js v2 but this
 * code has NOT been tested against a live Supabase project. No Supabase
 * credentials are available in the build environment. Every method is
 * structurally complete but must be integration-tested before production.
 *
 * MISSING BEFORE PRODUCTION:
 * - Integration tests against a real Supabase project.
 * - PKCE code_verifier / code_challenge storage: these are currently assumed
 *   to be managed by the Next.js route handlers (setting / reading cookies),
 *   with values passed into handleOAuthCallback. Ensure the cookie names match
 *   middleware expectations.
 * - MFA: Supabase's MFA API (supabase.auth.mfa.*) is called but NOT tested.
 * - signOutEverywhere: uses supabase.auth.admin.signOut which requires a
 *   service-role key. Verify RLS implications.
 * - Rate limiting: the interface accepts RateLimitContext but does not call
 *   packages/security. Wire that up at the call site.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brand } from "@submitpulse/config";
import type {
  AuthProvider,
  AuthResult,
  AuthSession,
  MfaEnrollment,
  OAuthRedirect,
  RateLimitContext,
  MagicLinkErrorCode,
  MfaErrorCode,
  OAuthErrorCode,
  PasswordResetErrorCode,
  PasswordResetRequestErrorCode,
  SessionErrorCode,
  SignInErrorCode,
  SignOutErrorCode,
  SignUpErrorCode,
  VerifyEmailErrorCode,
} from "./provider";

/* -------------------------------------------------------------------------- */
/* Required environment variables                                              */
/* -------------------------------------------------------------------------- */

/**
 * These are the env vars the provider needs, named via brand.env.var()
 * so they stay consistent if the product is renamed.
 *
 * SUPABASE_URL          → SP_SUPABASE_URL
 * SUPABASE_ANON_KEY     → SP_SUPABASE_ANON_KEY
 * SUPABASE_SERVICE_KEY  → SP_SUPABASE_SERVICE_KEY  (needed for admin signOut)
 */
const ENV = {
  url: brand.env.var("SUPABASE_URL"),
  anonKey: brand.env.var("SUPABASE_ANON_KEY"),
  serviceKey: brand.env.var("SUPABASE_SERVICE_KEY"),
} as const;

/* -------------------------------------------------------------------------- */
/* Configuration error                                                         */
/* -------------------------------------------------------------------------- */

export class SupabaseConfigError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      `[SupabaseProvider] Missing required environment variables:\n` +
        missing.map((v) => `  • ${v}`).join("\n") +
        `\n\nSet these in your .env.local (development) or deployment secrets (production).`,
    );
    this.name = "SupabaseConfigError";
    this.missing = missing;
  }
}

/* -------------------------------------------------------------------------- */
/* Helper: map Supabase error codes to our domain codes                       */
/* -------------------------------------------------------------------------- */

function mapSignInError(
  message: string,
): SignInErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("not confirmed") || lower.includes("email not confirmed")) {
    return "email_not_verified";
  }
  if (lower.includes("suspended") || lower.includes("banned")) {
    return "account_suspended";
  }
  // SECURITY — ENUMERATION PREVENTION: all other credential failures map to
  // the same generic code. Do not expose whether the account exists.
  return "invalid_credentials";
}

/* -------------------------------------------------------------------------- */
/* SupabaseProvider                                                            */
/* -------------------------------------------------------------------------- */

export class SupabaseProvider implements AuthProvider {
  readonly #client: SupabaseClient;
  /**
   * Service-role client for admin-only operations (signOutEverywhere).
   * INCOMPLETE: admin client creation is commented out until the supabase-js
   * import shape is confirmed. Requires @supabase/supabase-js to be installed
   * in the auth package (currently absent — npm is firewalled in this env).
   */
  // readonly #adminClient: SupabaseClient;

  constructor(client?: SupabaseClient) {
    const missing: string[] = [];

    for (const [, varName] of Object.entries(ENV)) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      throw new SupabaseConfigError(missing);
    }

    if (client) {
      // Allow injection for testing.
      this.#client = client;
    } else {
      /**
       * INCOMPLETE: createClient() call is structurally correct but NOT
       * invocable in this environment because @supabase/supabase-js is not
       * installed (npm is firewalled). In production, import createClient at
       * the top of this file and call it here.
       *
       * import { createClient } from "@supabase/supabase-js";
       * this.#client = createClient(
       *   process.env[ENV.url]!,
       *   process.env[ENV.anonKey]!,
       *   {
       *     auth: {
       *       autoRefreshToken: true,
       *       persistSession: false, // Server-side: sessions live in cookies, not localStorage.
       *       detectSessionInUrl: false,
       *       flowType: "pkce",
       *     },
       *   },
       * );
       */
      throw new Error(
        "[SupabaseProvider] INCOMPLETE: @supabase/supabase-js must be installed. " +
          "Run: pnpm add @supabase/supabase-js",
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* signUpWithPassword                                                        */
  /* ------------------------------------------------------------------------ */

  async signUpWithPassword(
    email: string,
    password: string,
    _rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<{ message: "check_email" }, SignUpErrorCode>> {
    /**
     * SECURITY — ENUMERATION PREVENTION:
     * Supabase's signUp returns a user object even for duplicate emails when
     * confirmations are enabled — we intentionally return the same "check_email"
     * response in all non-error cases. See Supabase docs on duplicate signups.
     */
    const { error } = await this.#client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: undefined },
    });

    if (error) {
      // Policy violations (too short, too common) are exposed as provider_error
      // to avoid leaking enumeration info.
      return {
        ok: false,
        code: "provider_error",
        message: "Unable to create account. Please try again.",
      };
    }

    return { ok: true, data: { message: "check_email" } };
  }

  /* ------------------------------------------------------------------------ */
  /* signInWithPassword                                                        */
  /* ------------------------------------------------------------------------ */

  async signInWithPassword(
    email: string,
    password: string,
    _rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<AuthSession, SignInErrorCode>> {
    const { data, error } = await this.#client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return {
        ok: false,
        code: mapSignInError(error?.message ?? ""),
        message: "Invalid email or password.",
      };
    }

    /**
     * SESSION FIXATION: Supabase rotates the JWT on successful sign-in
     * internally. We surface the new access_token as the session token.
     */
    return {
      ok: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1_000),
        userId: data.user.id,
        email: data.user.email ?? email,
        emailVerified: !!data.user.email_confirmed_at,
        mfaVerified: false, // elevated by verifyMfa
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /* signInWithOAuth                                                           */
  /* ------------------------------------------------------------------------ */

  async signInWithOAuth(
    provider: "google" | "github",
    redirectUri: string,
    _rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<OAuthRedirect, OAuthErrorCode>> {
    /**
     * SECURITY: Supabase generates the state and PKCE parameters internally
     * when flowType: "pkce" is configured on the client. The returned URL
     * already contains state + code_challenge. The caller (route handler) must
     * still store the state value in __Host-sp-oauth-state cookie for server-
     * side validation in the callback, because Supabase's cookie storage is
     * client-side and not available in middleware.
     *
     * INCOMPLETE: extracting the state from the generated URL requires parsing
     * it, which is brittle. A cleaner approach is to generate state and PKCE
     * manually and pass them to signInWithOAuth's options. Verify this against
     * the installed supabase-js version.
     */
    const { data, error } = await this.#client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUri,
        scopes: provider === "github" ? "read:user user:email" : "email profile",
        skipBrowserRedirect: true, // Let the route handler do the redirect.
      },
    });

    if (error || !data.url) {
      return {
        ok: false,
        code: "provider_error",
        message: "OAuth initialisation failed.",
      };
    }

    // Extract state from the URL for cookie storage.
    const url = new URL(data.url);
    const state = url.searchParams.get("state") ?? "";

    return { ok: true, data: { redirectUrl: data.url, state } };
  }

  /* ------------------------------------------------------------------------ */
  /* handleOAuthCallback                                                       */
  /* ------------------------------------------------------------------------ */

  async handleOAuthCallback(
    params: {
      code: string;
      state: string;
      storedState: string;
      codeVerifier: string;
    },
    _rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<AuthSession, OAuthErrorCode>> {
    /**
     * SECURITY — STATE VALIDATION:
     * Compare the state from the callback URL against the value we stored
     * in the cookie during signInWithOAuth. Mismatch means CSRF — reject.
     */
    if (params.state !== params.storedState) {
      return {
        ok: false,
        code: "invalid_state",
        message: "OAuth state mismatch. Possible CSRF attempt.",
      };
    }

    /**
     * INCOMPLETE: Supabase PKCE exchange requires passing the code_verifier.
     * The exact API shape (exchangeCodeForSession vs manual exchange) depends
     * on the supabase-js version. Verify before production.
     */
    const { data, error } =
      await this.#client.auth.exchangeCodeForSession(params.code);

    if (error || !data.session) {
      return {
        ok: false,
        code: "provider_error",
        message: "OAuth code exchange failed.",
      };
    }

    return {
      ok: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1_000),
        userId: data.user.id,
        email: data.user.email ?? "",
        emailVerified: !!data.user.email_confirmed_at,
        mfaVerified: false,
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /* sendMagicLink                                                             */
  /* ------------------------------------------------------------------------ */

  async sendMagicLink(
    email: string,
    redirectTo: string,
    _rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<{ message: "check_email" }, MagicLinkErrorCode>> {
    /**
     * SECURITY — ENUMERATION PREVENTION:
     * Supabase returns an error for unknown emails if "Disable email signup"
     * is enabled. We swallow all errors and return ok:true to prevent
     * revealing whether the email is registered.
     */
    await this.#client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });

    return { ok: true, data: { message: "check_email" } };
  }

  /* ------------------------------------------------------------------------ */
  /* verifyEmail                                                               */
  /* ------------------------------------------------------------------------ */

  async verifyEmail(
    tokenValue: string,
  ): Promise<AuthResult<{ message: "verified" }, VerifyEmailErrorCode>> {
    /**
     * INCOMPLETE: Supabase handles email verification via redirect links that
     * contain token_hash and type=email. The route handler should call
     * supabase.auth.verifyOtp({ token_hash, type: "email" }). This stub
     * shows the intent; the actual implementation goes in the auth/callback
     * route handler in apps/web.
     */
    const { error } = await this.#client.auth.verifyOtp({
      token_hash: tokenValue,
      type: "email",
    });

    if (error) {
      if (error.message.toLowerCase().includes("expired")) {
        return {
          ok: false,
          code: "token_expired",
          message: "Verification link has expired.",
        };
      }
      return {
        ok: false,
        code: "invalid_token",
        message: "Verification link is invalid.",
      };
    }

    return { ok: true, data: { message: "verified" } };
  }

  /* ------------------------------------------------------------------------ */
  /* requestPasswordReset                                                      */
  /* ------------------------------------------------------------------------ */

  async requestPasswordReset(
    email: string,
    _rateLimitCtx: RateLimitContext,
  ): Promise<
    AuthResult<{ message: "check_email" }, PasswordResetRequestErrorCode>
  > {
    /**
     * SECURITY — ENUMERATION PREVENTION:
     * Supabase's resetPasswordForEmail does not reveal whether the email
     * exists. We additionally swallow errors to ensure our response is
     * indistinguishable for registered vs unregistered addresses.
     */
    await this.#client.auth.resetPasswordForEmail(email);
    return { ok: true, data: { message: "check_email" } };
  }

  /* ------------------------------------------------------------------------ */
  /* resetPassword                                                             */
  /* ------------------------------------------------------------------------ */

  async resetPassword(
    _token: string,
    newPassword: string,
  ): Promise<AuthResult<AuthSession, PasswordResetErrorCode>> {
    /**
     * INCOMPLETE: Supabase password reset works via a redirect link that sets
     * a session. The user arrives at /reset-password/confirm already
     * authenticated (session in cookies); we then call updateUser.
     * The `_token` parameter is not used directly here — the route handler
     * should call supabase.auth.verifyOtp({ token_hash, type: "recovery" })
     * first to establish the session, then call this method.
     */
    const { data, error } = await this.#client.auth.updateUser({
      password: newPassword,
    });

    if (error || !data.user) {
      return {
        ok: false,
        code: "policy_violation",
        message: "Unable to set new password.",
      };
    }

    const sessionResult = await this.getSession();
    if (!sessionResult.ok) {
      return {
        ok: false,
        code: "invalid_token",
        message: "Session lost after password reset.",
      };
    }

    return { ok: true, data: sessionResult.data };
  }

  /* ------------------------------------------------------------------------ */
  /* getSession                                                                */
  /* ------------------------------------------------------------------------ */

  async getSession(): Promise<AuthResult<AuthSession, SessionErrorCode>> {
    const { data, error } = await this.#client.auth.getSession();

    if (error || !data.session) {
      return {
        ok: false,
        code: "no_session",
        message: "No active session.",
      };
    }

    const s = data.session;
    return {
      ok: true,
      data: {
        accessToken: s.access_token,
        refreshToken: s.refresh_token,
        expiresAt: new Date(s.expires_at! * 1_000),
        userId: s.user.id,
        email: s.user.email ?? "",
        emailVerified: !!s.user.email_confirmed_at,
        mfaVerified: false, // INCOMPLETE: read from aal claim in the JWT
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /* signOut                                                                   */
  /* ------------------------------------------------------------------------ */

  async signOut(): Promise<
    AuthResult<{ message: "signed_out" }, SignOutErrorCode>
  > {
    const { error } = await this.#client.auth.signOut({ scope: "local" });

    if (error) {
      return {
        ok: false,
        code: "provider_error",
        message: "Sign-out failed.",
      };
    }

    return { ok: true, data: { message: "signed_out" } };
  }

  /* ------------------------------------------------------------------------ */
  /* signOutEverywhere                                                         */
  /* ------------------------------------------------------------------------ */

  async signOutEverywhere(): Promise<
    AuthResult<{ message: "signed_out_everywhere" }, SignOutErrorCode>
  > {
    /**
     * INCOMPLETE: "global" scope signOut requires the service-role key.
     * Wire in the admin client with SP_SUPABASE_SERVICE_KEY before enabling.
     */
    const { error } = await this.#client.auth.signOut({ scope: "global" });

    if (error) {
      return {
        ok: false,
        code: "provider_error",
        message: "Sign-out everywhere failed.",
      };
    }

    return { ok: true, data: { message: "signed_out_everywhere" } };
  }

  /* ------------------------------------------------------------------------ */
  /* enrollMfa                                                                 */
  /* ------------------------------------------------------------------------ */

  async enrollMfa(): Promise<AuthResult<MfaEnrollment, MfaErrorCode>> {
    /**
     * INCOMPLETE: Supabase MFA enrolment API (supabase.auth.mfa.enroll)
     * must be tested against a project with MFA enabled.
     */
    const { data, error } = await this.#client.auth.mfa.enroll({
      factorType: "totp",
    });

    if (error || !data) {
      return {
        ok: false,
        code: "already_enrolled",
        message: "MFA enrolment failed.",
      };
    }

    return {
      ok: true,
      data: {
        provisioningUri: (data as { totp?: { qr_code?: string; uri?: string } }).totp?.uri ?? "",
        secret: (data as { totp?: { secret?: string } }).totp?.secret ?? "",
        recoveryCodes: [], // Supabase does not return recovery codes from enroll
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /* verifyMfa                                                                 */
  /* ------------------------------------------------------------------------ */

  async verifyMfa(
    code: string,
    _rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<AuthSession, MfaErrorCode>> {
    /**
     * INCOMPLETE: requires knowing the factor_id from the enrolment step.
     * The factor_id should be stored in the session or passed in. This
     * implementation will not compile until supabase-js is installed and
     * the factor_id is threaded through.
     *
     * SESSION FIXATION: Supabase issues a new JWT with aal2 claim after
     * successful MFA verification — this replaces the previous access_token.
     */
    const { data: listData } = await this.#client.auth.mfa.listFactors();
    const factor = listData?.totp?.[0];

    if (!factor) {
      return {
        ok: false,
        code: "not_enrolled",
        message: "No MFA factor enrolled.",
      };
    }

    const { data: challengeData, error: challengeError } =
      await this.#client.auth.mfa.challenge({ factorId: factor.id });

    if (challengeError || !challengeData) {
      return {
        ok: false,
        code: "invalid_code",
        message: "MFA challenge failed.",
      };
    }

    const { data: verifyData, error: verifyError } =
      await this.#client.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code,
      });

    if (verifyError || !verifyData) {
      return {
        ok: false,
        code: "invalid_code",
        message: "Invalid MFA code.",
      };
    }

    const sessionResult = await this.getSession();
    if (!sessionResult.ok) {
      return {
        ok: false,
        code: "invalid_code",
        message: "Session lost after MFA verification.",
      };
    }

    return {
      ok: true,
      data: { ...sessionResult.data, mfaVerified: true },
    };
  }
}

// Hash helper used in constructing consistent user IDs from emails in tests.
export function _emailToStableId(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex");
}
