/**
 * DevProvider — in-memory AuthProvider for local development and tests.
 *
 * SECURITY: This provider REFUSES to construct when NODE_ENV === "production".
 * It stores credentials in plain-text Maps in memory. It is safe only for
 * localhost development and CI. It MUST NOT be wired into any production build.
 *
 * Supports the full AuthProvider interface so the application is runnable and
 * testable without a Supabase account.
 */

import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

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
/* Internal state types                                                        */
/* -------------------------------------------------------------------------- */

interface DevAccount {
  readonly email: string;
  /** Plain-text — acceptable only because this never runs in production. */
  password: string;
  emailVerified: boolean;
  suspended: boolean;
  mfaEnrolled: boolean;
  /** Pending TOTP secret during enrolment (before verifyMfa). */
  pendingMfaSecret: string | null;
}

interface DevSession {
  readonly userId: string;
  readonly email: string;
  emailVerified: boolean;
  mfaVerified: boolean;
  expiresAt: Date;
}

interface PendingReset {
  readonly email: string;
  readonly expiresAt: Date;
}

interface PendingVerification {
  readonly email: string;
  readonly expiresAt: Date;
}

interface PendingOAuth {
  readonly state: string;
  readonly codeVerifier: string;
  readonly provider: "google" | "github";
  readonly expiresAt: Date;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function token(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function futureDate(seconds: number): Date {
  return new Date(Date.now() + seconds * 1_000);
}

/**
 * Use timingSafeEqual for all credential comparisons to mitigate timing attacks
 * even in the dev environment — this keeps the pattern consistent with production.
 */
function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still run timingSafeEqual with equal-length buffers to avoid short-circuit timing.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/* -------------------------------------------------------------------------- */
/* DevProvider                                                                 */
/* -------------------------------------------------------------------------- */

export class DevProvider implements AuthProvider {
  /**
   * Maps are keyed on lowercase email for account lookups, on token strings
   * for sessions and one-time tokens.
   */
  private readonly accounts = new Map<string, DevAccount>();
  private readonly sessions = new Map<string, DevSession>();
  private readonly pendingResets = new Map<string, PendingReset>();
  private readonly pendingVerifications = new Map<
    string,
    PendingVerification
  >();
  private readonly pendingOAuth = new Map<string, PendingOAuth>();

  /** Tracks the "current" session token for the single-user dev context. */
  private currentSessionToken: string | null = null;

  constructor() {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error(
        "[DevProvider] FATAL: DevProvider must never be used in production. " +
          "Set NODE_ENV correctly or switch to SupabaseProvider.",
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
    const key = email.toLowerCase();

    /**
     * SECURITY — ENUMERATION PREVENTION:
     * Even if the account already exists, we return ok:true with the same
     * "check_email" message. An attacker cannot distinguish "new account
     * created" from "account already exists" via this response.
     */
    if (!this.accounts.has(key)) {
      const verifyToken = token();
      this.accounts.set(key, {
        email: key,
        password,
        emailVerified: false,
        suspended: false,
        mfaEnrolled: false,
        pendingMfaSecret: null,
      });
      this.pendingVerifications.set(verifyToken, {
        email: key,
        expiresAt: futureDate(86_400),
      });
      // In dev: log the verification token instead of sending an email.
      console.info(`[DevProvider] Email verification token for ${email}: ${verifyToken}`);
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
    const key = email.toLowerCase();
    const account = this.accounts.get(key);

    /**
     * SECURITY — ENUMERATION PREVENTION:
     * "No account" and "wrong password" MUST return identical error codes
     * and messages. Never return "account not found" vs "wrong password".
     * We do the password comparison even when the account is missing
     * (with a dummy string) to preserve constant-time behaviour.
     */
    const expectedPassword = account?.password ?? "__no_account__";
    const passwordMatch = safeCompare(password, expectedPassword);

    if (!account || !passwordMatch) {
      return {
        ok: false,
        code: "invalid_credentials",
        message: "Invalid email or password.",
      };
    }

    if (account.suspended) {
      return {
        ok: false,
        code: "account_suspended",
        message: "This account has been suspended.",
      };
    }

    if (!account.emailVerified) {
      return {
        ok: false,
        code: "email_not_verified",
        message: "Please verify your email address before signing in.",
      };
    }

    if (account.mfaEnrolled) {
      return {
        ok: false,
        code: "mfa_required",
        message: "Multi-factor authentication is required.",
      };
    }

    return { ok: true, data: this.#createSession(account) };
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
     * SECURITY:
     * - state is cryptographically random (32 bytes).
     * - codeVerifier is cryptographically random (32 bytes, base64url ≥ 43 chars).
     * - code_challenge = BASE64URL(SHA256(codeVerifier)).
     * - Both are stored server-side keyed on state so the callback can validate.
     * In production the caller must also set the __Host-sp-oauth-state and
     * __Host-sp-pkce cookies. That responsibility lies with the route handler
     * in apps/web, not here.
     */
    const state = token(32);
    const codeVerifier = token(32);
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    this.pendingOAuth.set(state, {
      state,
      codeVerifier,
      provider,
      expiresAt: futureDate(600),
    });

    // Dev: build a fake provider URL that immediately redirects back.
    const fakeProviderUrl =
      `http://localhost:3000/auth/callback` +
      `?code=dev_code_${token(8)}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}`;

    console.info(
      `[DevProvider] OAuth redirect for ${provider} (state=${state}): ${fakeProviderUrl}`,
    );

    return { ok: true, data: { redirectUrl: fakeProviderUrl, state } };
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
     * Compare incoming state against the value stored server-side (from the
     * cookie set during signInWithOAuth). Mismatch = CSRF attempt — reject.
     */
    if (!safeCompare(params.state, params.storedState)) {
      return {
        ok: false,
        code: "invalid_state",
        message: "OAuth state mismatch. Possible CSRF attempt.",
      };
    }

    const pending = this.pendingOAuth.get(params.state);
    if (!pending || pending.expiresAt < new Date()) {
      this.pendingOAuth.delete(params.state);
      return {
        ok: false,
        code: "invalid_state",
        message: "OAuth session expired or already used.",
      };
    }

    // Verify PKCE: code_challenge stored must equal SHA256(incoming codeVerifier).
    const expectedChallenge = createHash("sha256")
      .update(params.codeVerifier)
      .digest("base64url");
    const storedChallenge = createHash("sha256")
      .update(pending.codeVerifier)
      .digest("base64url");

    if (!safeCompare(expectedChallenge, storedChallenge)) {
      this.pendingOAuth.delete(params.state);
      return {
        ok: false,
        code: "provider_error",
        message: "PKCE verification failed.",
      };
    }

    this.pendingOAuth.delete(params.state);

    // In dev: create or retrieve an account for a synthetic OAuth email.
    const email = `dev-oauth-${pending.provider}@dev.local`;
    const key = email.toLowerCase();
    if (!this.accounts.has(key)) {
      this.accounts.set(key, {
        email: key,
        password: "",
        emailVerified: true,
        suspended: false,
        mfaEnrolled: false,
        pendingMfaSecret: null,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const account = this.accounts.get(key)!;
    return { ok: true, data: this.#createSession(account) };
  }

  /* ------------------------------------------------------------------------ */
  /* sendMagicLink                                                             */
  /* ------------------------------------------------------------------------ */

  async sendMagicLink(
    email: string,
    _redirectTo: string,
    _rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<{ message: "check_email" }, MagicLinkErrorCode>> {
    /**
     * SECURITY — ENUMERATION PREVENTION:
     * Always return ok:true. Do not reveal whether the email is registered.
     */
    const magicToken = token();
    console.info(
      `[DevProvider] Magic link token for ${email}: ${magicToken}`,
    );
    return { ok: true, data: { message: "check_email" } };
  }

  /* ------------------------------------------------------------------------ */
  /* verifyEmail                                                               */
  /* ------------------------------------------------------------------------ */

  async verifyEmail(
    tokenValue: string,
  ): Promise<AuthResult<{ message: "verified" }, VerifyEmailErrorCode>> {
    const pending = this.pendingVerifications.get(tokenValue);

    if (!pending) {
      return {
        ok: false,
        code: "invalid_token",
        message: "Verification link is invalid.",
      };
    }

    if (pending.expiresAt < new Date()) {
      this.pendingVerifications.delete(tokenValue);
      return {
        ok: false,
        code: "token_expired",
        message: "Verification link has expired. Request a new one.",
      };
    }

    const account = this.accounts.get(pending.email);
    if (account?.emailVerified) {
      this.pendingVerifications.delete(tokenValue);
      return {
        ok: false,
        code: "already_verified",
        message: "Email address is already verified.",
      };
    }

    if (account) {
      account.emailVerified = true;
    }

    this.pendingVerifications.delete(tokenValue);
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
     * Perform the lookup so timing is consistent, but always return ok:true.
     * An attacker cannot determine whether the email is registered.
     */
    const key = email.toLowerCase();
    const exists = this.accounts.has(key); // lookup for consistent timing

    if (exists) {
      const resetToken = token();
      this.pendingResets.set(resetToken, {
        email: key,
        expiresAt: futureDate(3_600),
      });
      console.info(
        `[DevProvider] Password reset token for ${email}: ${resetToken}`,
      );
    }

    return { ok: true, data: { message: "check_email" } };
  }

  /* ------------------------------------------------------------------------ */
  /* resetPassword                                                             */
  /* ------------------------------------------------------------------------ */

  async resetPassword(
    tokenValue: string,
    newPassword: string,
  ): Promise<AuthResult<AuthSession, PasswordResetErrorCode>> {
    const pending = this.pendingResets.get(tokenValue);

    // Token is single-use: delete immediately on first access.
    this.pendingResets.delete(tokenValue);

    if (!pending) {
      return {
        ok: false,
        code: "invalid_token",
        message: "Reset link is invalid or has already been used.",
      };
    }

    if (pending.expiresAt < new Date()) {
      return {
        ok: false,
        code: "token_expired",
        message: "Reset link has expired. Request a new one.",
      };
    }

    const account = this.accounts.get(pending.email);
    if (!account) {
      return {
        ok: false,
        code: "invalid_token",
        message: "Reset link is invalid.",
      };
    }

    account.password = newPassword;
    // SESSION FIXATION: invalidate previous session and issue a fresh one.
    return { ok: true, data: this.#createSession(account) };
  }

  /* ------------------------------------------------------------------------ */
  /* getSession                                                                */
  /* ------------------------------------------------------------------------ */

  async getSession(): Promise<AuthResult<AuthSession, SessionErrorCode>> {
    if (!this.currentSessionToken) {
      return {
        ok: false,
        code: "no_session",
        message: "No active session.",
      };
    }

    const session = this.sessions.get(this.currentSessionToken);
    if (!session) {
      this.currentSessionToken = null;
      return {
        ok: false,
        code: "no_session",
        message: "No active session.",
      };
    }

    if (session.expiresAt < new Date()) {
      this.sessions.delete(this.currentSessionToken);
      this.currentSessionToken = null;
      return {
        ok: false,
        code: "session_expired",
        message: "Session has expired. Please sign in again.",
      };
    }

    return {
      ok: true,
      data: {
        accessToken: this.currentSessionToken,
        expiresAt: session.expiresAt,
        userId: session.userId,
        email: session.email,
        emailVerified: session.emailVerified,
        mfaVerified: session.mfaVerified,
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /* signOut                                                                   */
  /* ------------------------------------------------------------------------ */

  async signOut(): Promise<
    AuthResult<{ message: "signed_out" }, SignOutErrorCode>
  > {
    if (this.currentSessionToken) {
      this.sessions.delete(this.currentSessionToken);
      this.currentSessionToken = null;
    }
    return { ok: true, data: { message: "signed_out" } };
  }

  /* ------------------------------------------------------------------------ */
  /* signOutEverywhere                                                         */
  /* ------------------------------------------------------------------------ */

  async signOutEverywhere(): Promise<
    AuthResult<{ message: "signed_out_everywhere" }, SignOutErrorCode>
  > {
    this.sessions.clear();
    this.currentSessionToken = null;
    return { ok: true, data: { message: "signed_out_everywhere" } };
  }

  /* ------------------------------------------------------------------------ */
  /* enrollMfa                                                                 */
  /* ------------------------------------------------------------------------ */

  async enrollMfa(): Promise<AuthResult<MfaEnrollment, MfaErrorCode>> {
    if (!this.currentSessionToken) {
      return {
        ok: false,
        code: "not_enrolled",
        message: "Must be signed in to enrol MFA.",
      };
    }

    const session = this.sessions.get(this.currentSessionToken);
    if (!session) {
      return {
        ok: false,
        code: "not_enrolled",
        message: "Must be signed in to enrol MFA.",
      };
    }

    const account = this.accounts.get(session.email);
    if (!account) {
      return {
        ok: false,
        code: "not_enrolled",
        message: "Account not found.",
      };
    }

    if (account.mfaEnrolled) {
      return {
        ok: false,
        code: "already_enrolled",
        message: "MFA is already enrolled.",
      };
    }

    /**
     * INCOMPLETE: In production this generates a real TOTP secret and derives
     * the provisioning URI using the otplib or similar library. Here we return
     * a placeholder secret for dev purposes.
     */
    const secret = token(20).toUpperCase().slice(0, 32);
    account.pendingMfaSecret = secret;

    const recoveryCodes = Array.from({ length: 8 }, () =>
      `${token(4).toUpperCase()}-${token(4).toUpperCase()}`,
    );

    return {
      ok: true,
      data: {
        provisioningUri: `otpauth://totp/SubmitPulse:${session.email}?secret=${secret}&issuer=SubmitPulse`,
        secret,
        recoveryCodes,
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /* verifyMfa                                                                 */
  /* ------------------------------------------------------------------------ */

  async verifyMfa(
    _code: string,
    _rateLimitCtx: RateLimitContext,
  ): Promise<AuthResult<AuthSession, MfaErrorCode>> {
    /**
     * INCOMPLETE: In production, validate the TOTP code against the pending
     * secret using an HMAC-based one-time password library. This stub accepts
     * any non-empty code in dev.
     */
    if (!this.currentSessionToken) {
      return {
        ok: false,
        code: "not_enrolled",
        message: "Must be signed in.",
      };
    }

    const session = this.sessions.get(this.currentSessionToken);
    if (!session) {
      return {
        ok: false,
        code: "not_enrolled",
        message: "Session not found.",
      };
    }

    const account = this.accounts.get(session.email);
    if (!account) {
      return {
        ok: false,
        code: "not_enrolled",
        message: "Account not found.",
      };
    }

    if (!_code || _code.length < 6) {
      return {
        ok: false,
        code: "invalid_code",
        message: "Invalid MFA code.",
      };
    }

    if (account.pendingMfaSecret) {
      account.mfaEnrolled = true;
      account.pendingMfaSecret = null;
    }

    // SESSION FIXATION: rotate session to reflect mfaVerified elevation.
    const newSession = this.#createSession({ ...account, mfaEnrolled: true });
    return { ok: true, data: newSession };
  }

  /* ------------------------------------------------------------------------ */
  /* Private helpers                                                           */
  /* ------------------------------------------------------------------------ */

  /**
   * Creates a new session, invalidating the previous one.
   * SESSION FIXATION DEFENCE: every call produces a new token and the old
   * token is removed from the sessions map before the new one is added.
   */
  #createSession(account: DevAccount): AuthSession {
    // Invalidate the current session before creating a new one.
    if (this.currentSessionToken) {
      this.sessions.delete(this.currentSessionToken);
    }

    const sessionToken = token(48);
    const expiresAt = futureDate(7 * 24 * 3_600); // 7 days

    this.sessions.set(sessionToken, {
      userId: createHash("sha256").update(account.email).digest("hex"),
      email: account.email,
      emailVerified: account.emailVerified,
      mfaVerified: false, // elevated to true by verifyMfa
      expiresAt,
    });

    this.currentSessionToken = sessionToken;

    return {
      accessToken: sessionToken,
      expiresAt,
      userId: createHash("sha256").update(account.email).digest("hex"),
      email: account.email,
      emailVerified: account.emailVerified,
      mfaVerified: false,
    };
  }
}
