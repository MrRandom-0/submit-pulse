/**
 * Rate limiter abstraction.
 *
 * The interface is generic so the hot path (ingest) is decoupled from the
 * storage backend. Ship two drivers:
 *
 *   1. InMemoryRateLimiter   — development / unit tests only.
 *   2. UpstashRateLimiter    — INCOMPLETE: requires Redis credentials.
 *                              Marked clearly; will throw if instantiated
 *                              without the required env vars.
 */

// ---------------------------------------------------------------------------
// Core interface
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  /** Whether the request is within the allowed rate. */
  readonly allowed: boolean;
  /** Remaining requests in the current window. */
  readonly remaining: number;
  /** Epoch-seconds when the window resets. */
  readonly resetAt: number;
  /** Requests allowed per window. */
  readonly limit: number;
}

/**
 * All callers use this interface. Never depend on a concrete class directly.
 */
export interface RateLimiter {
  /**
   * Check whether `key` is within `limit` requests per `windowSeconds`.
   * Increments the counter and returns the updated state.
   */
  check(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult>;
}

// ---------------------------------------------------------------------------
// Well-known rate-limit key builders
// ---------------------------------------------------------------------------

export const rateLimitKeys = {
  /** One IP across all forms. */
  ip: (ip: string) => `rl:ip:${ip}`,
  /** One IP per form. */
  ipForm: (ip: string, formId: string) => `rl:ip:${ip}:form:${formId}`,
  /** All submissions for one form, regardless of IP. */
  form: (formId: string) => `rl:form:${formId}`,
  /** All submissions for one workspace. */
  workspace: (workspaceId: string) => `rl:workspace:${workspaceId}`,
  /** API key usage. */
  apiKey: (keyHash: string) => `rl:apikey:${keyHash}`,
  /** File upload quota. */
  upload: (ip: string) => `rl:upload:${ip}`,
  /** Auth attempts (login, setup token). */
  auth: (identifier: string) => `rl:auth:${identifier}`,
};

// ---------------------------------------------------------------------------
// Driver 1: In-memory (development / tests)
// ---------------------------------------------------------------------------

interface WindowEntry {
  count: number;
  windowStart: number; // epoch-seconds
}

/**
 * Sliding fixed-window rate limiter backed by a JS Map.
 *
 * NOT suitable for production:
 *  - State is not shared across Worker instances or restarts.
 *  - Memory grows without bound if many distinct keys are used.
 *
 * Use only for local development and unit tests.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly store = new Map<string, WindowEntry>();

  async check(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const entry = this.store.get(key);

    if (entry === undefined || nowSeconds >= entry.windowStart + windowSeconds) {
      // New window.
      const next: WindowEntry = { count: 1, windowStart: nowSeconds };
      this.store.set(key, next);
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: nowSeconds + windowSeconds,
        limit,
      };
    }

    entry.count++;
    const allowed = entry.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.windowStart + windowSeconds,
      limit,
    };
  }

  /** For tests: reset all counters. */
  clear(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// Driver 2: Upstash Redis — INCOMPLETE
// ---------------------------------------------------------------------------

/**
 * INCOMPLETE — Upstash Redis rate limiter.
 *
 * This driver is intentionally non-functional. It exists as a compile-time
 * contract and deployment placeholder. DO NOT remove the INCOMPLETE markers —
 * they are checked by the architecture review process.
 *
 * To complete this driver:
 *   1. Install @upstash/ratelimit and @upstash/redis (already listed in deps).
 *   2. Set the environment variables below in wrangler.toml and Cloudflare
 *      dashboard (as secrets, not plain text):
 *        SP_UPSTASH_REDIS_REST_URL   — the Upstash Redis REST URL
 *        SP_UPSTASH_REDIS_REST_TOKEN — the Upstash Redis REST token
 *   3. Replace the stub body with a real sliding window implementation using
 *      Upstash's INCR + EXPIRE pipeline, or use @upstash/ratelimit directly.
 *   4. Remove the "INCOMPLETE" markers and the throw below.
 *
 * Required env vars:
 *   SP_UPSTASH_REDIS_REST_URL
 *   SP_UPSTASH_REDIS_REST_TOKEN
 */
export class UpstashRateLimiter implements RateLimiter {
  constructor(
    _opts: {
      readonly restUrl: string; // from env: SP_UPSTASH_REDIS_REST_URL
      readonly restToken: string; // from env: SP_UPSTASH_REDIS_REST_TOKEN
    },
  ) {
    // INCOMPLETE: constructor body intentionally empty until driver is implemented.
  }

  // INCOMPLETE
  async check(
    _key: string,
    _limit: number,
    _windowSeconds: number,
  ): Promise<RateLimitResult> {
    // INCOMPLETE: this method is not implemented.
    // It throws unconditionally so a misconfigured deployment fails loudly
    // rather than silently bypassing rate limits.
    throw new Error(
      "UpstashRateLimiter is INCOMPLETE. " +
        "Set SP_UPSTASH_REDIS_REST_URL and SP_UPSTASH_REDIS_REST_TOKEN " +
        "and implement the Redis sliding-window logic before use.",
    );
  }
}
