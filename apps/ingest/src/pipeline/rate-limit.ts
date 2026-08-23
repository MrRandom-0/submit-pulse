/**
 * Stage 3 — Rate limiting.
 *
 * Multiple independent limits are checked in priority order:
 *   1. Per-IP across all forms (global flood protection)
 *   2. Per-IP per-form (targeted abuse)
 *   3. Per-form (form-level ceiling regardless of IP)
 *
 * All checks are performed against the RateLimiter interface so the
 * underlying driver (InMemory vs Upstash) is irrelevant here.
 */

import { rateLimitKeys } from "@submitpulse/security/rate-limit";
import type { RateLimiter } from "@submitpulse/security/rate-limit";
import { Errors } from "../response.js";

/** Global: 60 submissions per IP per minute across all forms. */
const IP_GLOBAL_LIMIT = 60;
const IP_GLOBAL_WINDOW_S = 60;

/** Per-form per-IP: 10 submissions per 5 minutes. */
const IP_FORM_LIMIT = 10;
const IP_FORM_WINDOW_S = 300;

/** Per-form ceiling: 500 submissions per minute. */
const FORM_LIMIT = 500;
const FORM_WINDOW_S = 60;

export async function checkRateLimits(
  ip: string,
  formId: string,
  limiter: RateLimiter,
  requestId: string,
  corsOrigin: string | null,
): Promise<Response | null> {
  // 1. Global IP limit.
  try {
    const ipGlobal = await limiter.check(
      rateLimitKeys.ip(ip),
      IP_GLOBAL_LIMIT,
      IP_GLOBAL_WINDOW_S,
    );
    if (!ipGlobal.allowed) {
      return Errors.rateLimited(requestId, corsOrigin);
    }

    // 2. Per-IP per-form limit.
    const ipForm = await limiter.check(
      rateLimitKeys.ipForm(ip, formId),
      IP_FORM_LIMIT,
      IP_FORM_WINDOW_S,
    );
    if (!ipForm.allowed) {
      return Errors.rateLimited(requestId, corsOrigin);
    }

    // 3. Per-form ceiling.
    const form = await limiter.check(
      rateLimitKeys.form(formId),
      FORM_LIMIT,
      FORM_WINDOW_S,
    );
    if (!form.allowed) {
      return Errors.rateLimited(requestId, corsOrigin);
    }
  } catch {
    // Rate limiter is a dependency — if it's down, fail open with logging.
    // In a production deployment this should be revisited based on risk tolerance.
    // Failing closed (returning 503) would be safer but could block legitimate traffic.
    console.error("[rate-limit] Rate limiter error — failing open");
  }

  return null; // All checks passed.
}
