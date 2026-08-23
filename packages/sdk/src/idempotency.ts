/**
 * Idempotency key helpers.
 *
 * PURPOSE: Prevent a double-click or accidental re-render from creating two
 * identical submissions. The caller is responsible for holding the key for the
 * lifetime of a single "submit attempt" and discarding it after a definitive
 * result (success or non-retriable error). Retries MUST reuse the same key.
 *
 * The API treats identical (endpoint, idempotencyKey) pairs within a short
 * window as the same request and returns the cached first response.
 */

/**
 * Generate a cryptographically random, URL-safe idempotency key.
 * Uses crypto.randomUUID when available (Node 19+, all modern browsers),
 * falling back to a manual 16-byte hex string via crypto.getRandomValues.
 */
export function generateIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Fallback: 128 bits of random, formatted as a UUID-ish hex string.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * A simple per-form key manager: generates once and caches until reset().
 * Useful when a single component owns a form and wants automatic deduplication.
 *
 * Usage:
 *   const key = new IdempotencyKeyManager();
 *   // on submit:
 *   await client.submit(data, { idempotencyKey: key.current });
 *   key.reset(); // generate a fresh key for the next submit
 */
export class IdempotencyKeyManager {
  #key: string = generateIdempotencyKey();

  /** The current active key. Stable until reset() is called. */
  get current(): string {
    return this.#key;
  }

  /** Rotate to a new key. Call after a definitive result. */
  reset(): void {
    this.#key = generateIdempotencyKey();
  }
}
