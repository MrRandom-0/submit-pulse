/**
 * Tests for retry backoff maths in packages/webhooks/src/retry.ts
 */

import { describe, it, expect } from "vitest";
import {
  computeBackoff,
  nextRetryAt,
  shouldAutoDisable,
  canRetry,
  RETRY_CONFIG,
} from "@submitpulse/webhooks";

describe("computeBackoff", () => {
  it("returns delayMs within [0, baseDelayMs] for first retry", () => {
    // Deterministic rand returning 0.5
    const result = computeBackoff(0, () => 0.5);
    // exponentialCap = min(maxDelay, base * 2^0) = min(7200000, 30000) = 30000
    // delay = floor(0.5 * 30000) = 15000
    expect(result.delayMs).toBe(15_000);
    expect(result.nextAttempt).toBe(1);
    expect(result.exhausted).toBe(false);
  });

  it("caps delay at maxDelayMs", () => {
    // After many attempts, cap kicks in
    const result = computeBackoff(20, () => 1.0 - Number.EPSILON);
    expect(result.delayMs).toBeLessThanOrEqual(RETRY_CONFIG.maxDelayMs);
  });

  it("returns exhausted when maxAttempts exceeded", () => {
    const result = computeBackoff(RETRY_CONFIG.maxAttempts, () => 0.5);
    expect(result.exhausted).toBe(true);
    expect(result.delayMs).toBe(0);
  });

  it("delay is zero when rand returns 0", () => {
    const result = computeBackoff(0, () => 0);
    expect(result.delayMs).toBe(0);
  });

  it("delay is never negative", () => {
    for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
      const result = computeBackoff(attempt, Math.random);
      expect(result.delayMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("nextAttempt increments monotonically", () => {
    for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
      const result = computeBackoff(attempt, () => 0.5);
      expect(result.nextAttempt).toBe(attempt + 1);
    }
  });
});

describe("nextRetryAt", () => {
  it("returns a date delayMs in the future", () => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    const result = nextRetryAt(60_000, now);
    expect(result.getTime()).toBe(now.getTime() + 60_000);
  });

  it("uses current time when no reference is passed", () => {
    const before = Date.now();
    const result = nextRetryAt(1000);
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 1000);
    expect(result.getTime()).toBeLessThanOrEqual(after + 1000);
  });
});

describe("shouldAutoDisable", () => {
  it("returns false below threshold", () => {
    expect(shouldAutoDisable(RETRY_CONFIG.autoDisableAfterConsecutiveFailures - 1)).toBe(false);
  });

  it("returns true at threshold", () => {
    expect(shouldAutoDisable(RETRY_CONFIG.autoDisableAfterConsecutiveFailures)).toBe(true);
  });

  it("returns true above threshold", () => {
    expect(shouldAutoDisable(RETRY_CONFIG.autoDisableAfterConsecutiveFailures + 5)).toBe(true);
  });
});

describe("canRetry", () => {
  it("returns true when attempts are below max", () => {
    expect(canRetry(0)).toBe(true);
    expect(canRetry(RETRY_CONFIG.maxAttempts - 1)).toBe(true);
  });

  it("returns false when at maxAttempts", () => {
    expect(canRetry(RETRY_CONFIG.maxAttempts)).toBe(false);
  });
});
