/**
 * CAPTCHA / bot-protection abstraction.
 *
 * Two drivers:
 *   1. TurnstileVerifier — Cloudflare Turnstile, server-side token verification.
 *                          NEVER trusts the client-side outcome.
 *   2. DevBypassVerifier — Explicit no-op for local development.
 *                          Refuses to run when NODE_ENV === "production".
 *
 * Any new provider (hCaptcha, reCAPTCHA v3) must implement CaptchaVerifier
 * and must never skip server-side verification.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface CaptchaResult {
  readonly success: boolean;
  readonly errorCodes: readonly string[];
  /** Challenge timestamp (ISO 8601), when available. */
  readonly challengeTs?: string | undefined;
  /** Hostname the challenge was issued for, when available. */
  readonly hostname?: string | undefined;
}

export interface CaptchaVerifier {
  /**
   * Verify a token that the client obtained from the CAPTCHA widget.
   * The token is short-lived and single-use — must be verified promptly.
   *
   * @param token    The client-submitted token.
   * @param remoteIp The client IP, for provider-side analytics.
   */
  verify(token: string, remoteIp?: string): Promise<CaptchaResult>;
}

// ---------------------------------------------------------------------------
// Driver 1: Cloudflare Turnstile
// ---------------------------------------------------------------------------

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileApiResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Cloudflare Turnstile — server-side token verification.
 *
 * Required env var:
 *   SP_TURNSTILE_SECRET_KEY — the Turnstile secret key (never the site key).
 *
 * The secret key MUST be kept server-side only. Exposing it to the browser
 * would allow attackers to forge successful verifications.
 */
export class TurnstileVerifier implements CaptchaVerifier {
  constructor(
    private readonly secretKey: string, // SP_TURNSTILE_SECRET_KEY
  ) {
    if (!secretKey || secretKey.trim() === "") {
      throw new Error(
        "TurnstileVerifier: secretKey must not be empty. " +
          "Set SP_TURNSTILE_SECRET_KEY in wrangler.toml secrets.",
      );
    }
  }

  async verify(token: string, remoteIp?: string): Promise<CaptchaResult> {
    if (!token || token.trim() === "") {
      return { success: false, errorCodes: ["missing-input-response"] };
    }

    const body = new URLSearchParams({ secret: this.secretKey, response: token });
    if (remoteIp !== undefined && remoteIp !== "") {
      body.set("remoteip", remoteIp);
    }

    let response: Response;
    try {
      response = await fetch(TURNSTILE_VERIFY_URL, {
        method: "POST",
        body,
        // Never follow redirects from the Turnstile endpoint.
        redirect: "error",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        errorCodes: [`fetch-error:${message}`],
      };
    }

    if (!response.ok) {
      return {
        success: false,
        errorCodes: [`http-error:${response.status}`],
      };
    }

    let json: TurnstileApiResponse;
    try {
      json = (await response.json()) as TurnstileApiResponse;
    } catch {
      return { success: false, errorCodes: ["invalid-json-response"] };
    }

    const result: CaptchaResult = {
      success: json.success,
      errorCodes: json["error-codes"] ?? [],
    };

    // Attach optional fields only when present.
    if (json.challenge_ts !== undefined) {
      return { ...result, challengeTs: json.challenge_ts };
    }
    if (json.hostname !== undefined) {
      return { ...result, hostname: json.hostname };
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// Driver 2: Dev bypass — EXPLICIT NO-OP, refuses in production
// ---------------------------------------------------------------------------

/**
 * DEV BYPASS VERIFIER — NOT for production.
 *
 * This driver accepts any token string without contacting an external service.
 * It exists so local development and integration tests do not require a live
 * Turnstile account.
 *
 * It WILL THROW if NODE_ENV === "production" or if the `env` parameter
 * passed to the constructor indicates a production deployment.
 *
 * To use: set NODE_ENV=development or NODE_ENV=test in your local env.
 */
export class DevBypassCaptchaVerifier implements CaptchaVerifier {
  constructor(opts?: { readonly env?: string }) {
    const nodeEnv = opts?.env ?? (typeof process !== "undefined" ? (process.env["NODE_ENV"] ?? "") : "");
    if (nodeEnv === "production") {
      throw new Error(
        "DevBypassCaptchaVerifier MUST NOT run in production. " +
          "Use TurnstileVerifier instead.",
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async verify(
    _token: string,
    _remoteIp?: string,
  ): Promise<CaptchaResult> {
    // DEV BYPASS: always succeeds. This is intentional and safe only in dev/test.
    return {
      success: true,
      errorCodes: [],
      challengeTs: new Date().toISOString(),
      hostname: "localhost",
    };
  }
}
