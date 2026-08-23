/**
 * Stage 6 — CAPTCHA verification.
 *
 * Only executed when `form.captchaEnabled === true`.
 *
 * The token must come from the request body (field name "cf-turnstile-response"
 * or "_captcha" for generic override) or the X-Captcha-Response header.
 * Server-side verification is MANDATORY — we never trust the client-side outcome.
 *
 * A missing token when CAPTCHA is required is treated as a failed check.
 */

import type { CaptchaVerifier } from "@submitpulse/security/captcha";
import { Errors } from "../response.js";

const CAPTCHA_FIELD_NAMES = [
  "cf-turnstile-response",
  "_captcha",
  "g-recaptcha-response",
  "h-captcha-response",
] as const;

const CAPTCHA_HEADER = "x-captcha-response";

export async function verifyCaptcha(
  captchaEnabled: boolean,
  payload: Record<string, unknown>,
  request: Request,
  clientIp: string,
  verifier: CaptchaVerifier,
  requestId: string,
  corsOrigin: string | null,
): Promise<{ cleanPayload: Record<string, unknown> } | Response> {
  if (!captchaEnabled) {
    return { cleanPayload: payload };
  }

  // Extract token from payload or header.
  let token: string | null = null;

  for (const field of CAPTCHA_FIELD_NAMES) {
    const v = payload[field];
    if (typeof v === "string" && v.trim() !== "") {
      token = v.trim();
      break;
    }
  }

  if (token === null) {
    token = request.headers.get(CAPTCHA_HEADER)?.trim() ?? null;
  }

  if (token === null || token === "") {
    return Errors.captchaFailed(requestId, corsOrigin);
  }

  let result;
  try {
    result = await verifier.verify(token, clientIp);
  } catch {
    // If the captcha provider is down, fail safe — reject the submission.
    return Errors.serviceUnavailable(requestId, corsOrigin);
  }

  if (!result.success) {
    return Errors.captchaFailed(requestId, corsOrigin);
  }

  // Strip captcha token fields from the payload before persistence.
  const cleanPayload: Record<string, unknown> = { ...payload };
  for (const field of CAPTCHA_FIELD_NAMES) {
    delete cleanPayload[field];
  }

  return { cleanPayload };
}
