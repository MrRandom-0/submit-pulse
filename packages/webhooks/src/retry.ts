/**
 * Webhook retry backoff — pure functions, no I/O, fully unit-testable.
 *
 * ALGORITHM: Exponential backoff with full jitter.
 *   delay = random(0, min(cap, base * 2^attempt))
 *
 * Full jitter avoids thundering-herd where many endpoints fail simultaneously
 * and then all retry at the same moment.
 *
 * AUTO-DISABLE: After AUTO_DISABLE_AFTER_CONSECUTIVE_FAILURES consecutive
 * failures the endpoint should be disabled. The worker reads shouldAutoDisable()
 * after every failure and sets webhookEndpoints.disabledAt when it returns true.
 */

export const RETRY_CONFIG = {
  /** Maximum number of delivery attempts (1 initial + N-1 retries). */
  maxAttempts: 7,
  /** Base delay in milliseconds (first retry ≈ 0–30 s). */
  baseDelayMs: 30_000,
  /** Maximum delay cap in milliseconds (≈ 2 hours). */
  maxDelayMs: 7_200_000,
  /** Consecutive failures before auto-disabling the endpoint. */
  autoDisableAfterConsecutiveFailures: 10,
} as const;

export interface BackoffResult {
  /** Milliseconds to wait before the next attempt. */
  delayMs: number;
  /** The attempt index this delay applies to (1-based). */
  nextAttempt: number;
  /** Whether no further attempts should be made. */
  exhausted: boolean;
}

/**
 * Compute the next retry delay for a webhook delivery.
 *
 * @param attemptsSoFar   Number of attempts already made (0 = initial delivery not yet attempted).
 * @param rand            Uniform random source in [0, 1). Injectable for testing.
 */
export function computeBackoff(
  attemptsSoFar: number,
  rand: () => number = Math.random,
): BackoffResult {
  const nextAttempt = attemptsSoFar + 1;

  if (nextAttempt > RETRY_CONFIG.maxAttempts) {
    return { delayMs: 0, nextAttempt, exhausted: true };
  }

  // Exponential cap: base * 2^attempt, capped at maxDelayMs.
  const exponentialCap = Math.min(
    RETRY_CONFIG.maxDelayMs,
    RETRY_CONFIG.baseDelayMs * Math.pow(2, attemptsSoFar),
  );

  // Full jitter: uniform in [0, cap).
  const delayMs = Math.floor(rand() * exponentialCap);

  return { delayMs, nextAttempt, exhausted: false };
}

/**
 * Convert a delay in milliseconds to the absolute Date when the next attempt
 * should be made.
 */
export function nextRetryAt(delayMs: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + delayMs);
}

/**
 * Determine whether a webhook endpoint should be auto-disabled based on its
 * current consecutive-failure count (AFTER recording the latest failure).
 */
export function shouldAutoDisable(consecutiveFailures: number): boolean {
  return consecutiveFailures >= RETRY_CONFIG.autoDisableAfterConsecutiveFailures;
}

/**
 * Whether more delivery attempts are permitted given the attempt count so far.
 */
export function canRetry(attemptsSoFar: number): boolean {
  return attemptsSoFar < RETRY_CONFIG.maxAttempts;
}
