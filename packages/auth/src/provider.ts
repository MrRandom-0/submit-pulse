/**
 * AuthProvider interface — the single abstraction boundary between the
 * application and any concrete authentication backend.
 *
 * DESIGN PRINCIPLES
 * -----------------
 * 1. Discriminated result types, never throws for expected failures.
 *    "User not found", "wrong password", "token expired" are all expected;
 *    network failures and configuration errors may still throw.
 *
 * 2. Enumeration safety: the interface intentionally conflates "wrong
 *    password" and "no such account" into a single `invalid_credentials`
 *    code so callers cannot distinguish the two cases. See individual method
 *    comments for the exact requirement.
 *
 * 3. Rate limiting is a cross-cutting concern; the provider accepts a
 *    RateLimitContext so the packages/security limiter can be injected at
 *    call sites without the provider knowing about it.
 *
 * 4. OAuth security: state parameter and PKCE are a provider responsibility.
 *    The provider must generate a cryptographically random state, store it
 *    in a short-lived cookie (httpOnly, secure, sameSite=lax, __Host- prefix
 *    where applicable), and reject any callback whose state does not match.
 *    PKCE (code_verifier / code_challenge) must be used for the authorization
 *    code flow regardless of whether the provider requires it, because it
 *    defends against CSRF even when the state check passes (defence in depth).
 *
 * 5. Session fixation: implementations MUST rotate the session identifier
 *    on every privilege elevation — login completion, MFA completion, and
 *    sudo-mode activation. The old session token must be invalidated
 *    server-side, not just replaced client-side.
 */

/* -------------------------------------------------------------------------- */
/* Shared result primitives                                                    */
/* -------------------------------------------------------------------------- */

export interface AuthSuccess<T = unknown> {
  readonly ok: true;
  readonly data: T;
}

export interface AuthFailure<
  C extends string = string,
  M extends string = string,
> {
  readonly ok: false;
  readonly code: C;
  readonly message: M;
}

export type AuthResult<T = unknown, C extends string = string> =
  | AuthSuccess<T>
  | AuthFailure<C>;

/* -------------------------------------------------------------------------- */
/* Domain types                                                                */
/* -------------------------------------------------------------------------- */

export interface AuthSession {
  /** Opaque session token — provider-specific format, never inspected here. */
  readonly accessToken: string;
  /** Long-lived token for silent refresh, if supported by the provider. */
  readonly refreshToken?: string;
  readonly expiresAt: Date;
  readonly userId: string;
  /** Email address as supplied by the provider at authentication time. */
  readonly email: string;
  readonly emailVerified: boolean;
  readonly mfaVerified: boolean;
}

export interface OAuthRedirect {
  /** The URL to redirect the user to for OAuth authorisation. */
  readonly redirectUrl: string;
  /**
   * The state value that was embedded in redirectUrl and stored server-side.
   * Callers do not need to handle this — it is included for testing only.
   */
  readonly state: string;
}

export interface MfaEnrollment {
  /** TOTP provisioning URI (for QR code display). */
  readonly provisioningUri: string;
  /** Plain-text TOTP secret (show once, then discard from memory). */
  readonly secret: string;
  /** Recovery codes — single-use. Must be shown exactly once. */
  readonly recoveryCodes: readonly string[];
}

/** Context passed to rate-limiting hooks in packages/security. */
export interface RateLimitContext {
  /** Normalised IP address string or undefined in test environments. */
  readonly ip?: string;
  /** Lowercase email, used as a secondary key for per-account limiting. */
  readonly email?: string;
}

/* -------------------------------------------------------------------------- */
/* Error code unions                                                           */
/* -------------------------------------------------------------------------- */

/**
 * SECURITY: all sign-in and sign-up failures that could reveal account
 * existence MUST use `invalid_credentials` so responses are indistinguishable.
 * See individual method comments for the contract.
 */
export type SignInErrorCode =
  | "invalid_credentials" // wrong password OR no such account (deliberately merged)
  | "email_not_verified"
  | "mfa_required"
  | "account_suspended"
  | "rate_limited";

export type SignUpErrorCode =
  | "invalid_credentials" // used for policy violations to avoid enumeration
  | "rate_limited"
  | "provider_error";

export type OAuthErrorCode =
  | "invalid_state" // CSRF / state mismatch
  | "provider_error"
  | "rate_limited";

export type MagicLinkErrorCode = "rate_limited" | "provider_error";

export type VerifyEmailErrorCode =
  | "invalid_token"
  | "token_expired"
  | "already_verified";

export type PasswordResetRequestErrorCode = "rate_limited" | "provider_error";

export type PasswordResetErrorCode =
  | "invalid_token"
  | "token_expired"
  | "policy_violation";

export type MfaErrorCode =
  | "invalid_code"
  | "already_enrolled"
  | "not_enrolled"
  | "rate_limited";

export type SessionErrorCode = "no_session" | "session_expired";

export type SignOutErrorCode = "provider_error";

/* -------------------------------------------------------------------------- */
/* AuthProvider interface                                                      */
/* -------------------------------------------------------------------------- */

export interface AuthProvider {
  /**
   * Register a new account with email + password.
   *
   * SECURITY: on success, always requires email verification before the
   * account can log in. The response MUST NOT distinguish between
   * "email already registered" and "new registration" — both return ok:true
   * with the same message so an attacker cannot enumerate existing accounts.
   *
   * NOTE: password hashing is entirely delegated to the provider.
   * We never hold password hashes in the application database.
   *
   * RATE LIMITING: implementations should call the injected rate limiter
   * keyed on ip + normalised email before processing.
   */
  signUpWithPassword(
    email: string,
    password: string,
    rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<{ message: "check_email" }, SignUpErrorCode>>;

  /**
   * Authenticate with email + password.
   *
   * SECURITY: "wrong password" and "no such account" MUST both return
   * { ok: false, code: "invalid_credentials" } — identical response bodies,
   * identical timing (implementations should use constant-time comparison
   * or delegate entirely to the provider's own verification). This prevents
   * account enumeration via login.
   *
   * SESSION FIXATION: on success a new session identifier MUST be issued
   * and the previous session (if any) invalidated server-side.
   *
   * RATE LIMITING: implementations should call the injected rate limiter
   * keyed on ip + normalised email before processing.
   */
  signInWithPassword(
    email: string,
    password: string,
    rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<AuthSession, SignInErrorCode>>;

  /**
   * Begin an OAuth flow for the given provider.
   *
   * SECURITY:
   * - Generate a cryptographically random `state` (min 32 bytes, base64url).
   * - Store it server-side in a short-lived cookie (__Host-sp-oauth-state,
   *   httpOnly, secure, sameSite=lax, max-age 600s).
   * - Generate a PKCE code_verifier (min 43 chars, base64url) and derive
   *   code_challenge = BASE64URL(SHA256(code_verifier)).
   * - Store code_verifier in __Host-sp-pkce cookie (same flags, same TTL).
   *
   * Returns the full redirect URL; the middleware handles the actual redirect.
   */
  signInWithOAuth(
    provider: "google" | "github",
    redirectUri: string,
    rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<OAuthRedirect, OAuthErrorCode>>;

  /**
   * Complete an OAuth flow after the provider callback.
   *
   * SECURITY:
   * - Validate that `state` matches the cookie set in signInWithOAuth.
   * - Exchange `code` using the stored code_verifier (PKCE).
   * - Clear both cookies immediately after reading.
   * - Rotate session identifier (session fixation defence).
   */
  handleOAuthCallback(
    params: {
      code: string;
      state: string;
      storedState: string;
      codeVerifier: string;
    },
    rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<AuthSession, OAuthErrorCode>>;

  /**
   * Send a magic-link (passwordless) email.
   *
   * SECURITY: same enumeration defence as signUpWithPassword — success and
   * "no such account" MUST return the same response shape.
   *
   * RATE LIMITING: keyed on ip + normalised email.
   */
  sendMagicLink(
    email: string,
    redirectTo: string,
    rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<{ message: "check_email" }, MagicLinkErrorCode>>;

  /**
   * Confirm an email address from the token in the verification link.
   *
   * SESSION FIXATION: if the user is signed in, rotate the session token
   * after verification to reflect the elevated trust level.
   */
  verifyEmail(
    token: string,
  ): Promise<AuthResult<{ message: "verified" }, VerifyEmailErrorCode>>;

  /**
   * Request a password-reset email.
   *
   * SECURITY: MUST return the same response whether or not the email exists.
   * Implementors must avoid timing differences (e.g. don't skip the DB
   * lookup — do the lookup but return ok:true regardless).
   *
   * RATE LIMITING: keyed on ip + normalised email.
   */
  requestPasswordReset(
    email: string,
    rateLimitCtx: RateLimitContext,
  ): Promise<
    AuthResult<{ message: "check_email" }, PasswordResetRequestErrorCode>
  >;

  /**
   * Set a new password using the one-time reset token.
   *
   * The token is single-use and must be invalidated after first use
   * (whether successful or not) to prevent replay.
   *
   * SESSION FIXATION: issue a fresh session after successful reset.
   */
  resetPassword(
    token: string,
    newPassword: string,
  ): Promise<AuthResult<AuthSession, PasswordResetErrorCode>>;

  /**
   * Return the current session, if one exists. Does NOT throw; returns
   * ok:false with code "no_session" or "session_expired".
   */
  getSession(): Promise<AuthResult<AuthSession, SessionErrorCode>>;

  /** Sign the current user out of the current session. */
  signOut(): Promise<AuthResult<{ message: "signed_out" }, SignOutErrorCode>>;

  /**
   * Sign the user out of ALL sessions (including other devices).
   * Used on password change, suspected compromise, and explicit "logout everywhere".
   */
  signOutEverywhere(): Promise<
    AuthResult<{ message: "signed_out_everywhere" }, SignOutErrorCode>
  >;

  /**
   * Begin TOTP enrolment — returns provisioning URI and recovery codes.
   *
   * Enrolment is not complete until verifyMfa succeeds with a valid TOTP code.
   * The secret must NOT be persisted until verification, to avoid half-enrolled
   * states that leak secrets.
   *
   * INCOMPLETE: TOTP verification step requires provider integration. The
   * in-memory dev provider simulates this.
   */
  enrollMfa(): Promise<AuthResult<MfaEnrollment, MfaErrorCode>>;

  /**
   * Verify a TOTP code (completing enrolment, or satisfying an MFA challenge).
   *
   * SESSION FIXATION: on success, rotate the session identifier to reflect
   * the elevated trust level (mfaVerified: true).
   *
   * RATE LIMITING: keyed on userId (already authenticated) and ip.
   */
  verifyMfa(
    code: string,
    rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<AuthSession, MfaErrorCode>>;
}
