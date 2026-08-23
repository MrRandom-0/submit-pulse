import type { ValidationFieldError } from "./types.js";

/**
 * Discriminated base for all Submit Pulse errors.
 * Consumers can switch on `error.kind` exhaustively without instanceof checks.
 */
export abstract class SubmitPulseError extends Error {
  abstract readonly kind:
    | "validation"
    | "rate_limit"
    | "origin"
    | "network"
    | "server";

  constructor(message: string) {
    super(message);
    this.name = "SubmitPulseError";
    // Restore prototype chain for transpiled ES5 targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 422 — the server rejected one or more field values. */
export class ValidationError extends SubmitPulseError {
  readonly kind = "validation" as const;
  /** Per-field errors for inline display. */
  readonly fieldErrors: readonly ValidationFieldError[];

  constructor(message: string, fieldErrors: ValidationFieldError[]) {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }

  /** Convenience: map field name → message for quick lookup in UI code. */
  get fieldMessages(): Record<string, string> {
    return Object.fromEntries(
      this.fieldErrors.map((e) => [e.field, e.message]),
    );
  }
}

/** HTTP 429 — the caller has exceeded the allowed submission rate. */
export class RateLimitError extends SubmitPulseError {
  readonly kind = "rate_limit" as const;
  /**
   * Seconds until the rate limit window resets, parsed from Retry-After.
   * Undefined when the header is absent.
   */
  readonly retryAfter: number | undefined;

  constructor(message: string, retryAfter: number | undefined) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * HTTP 403 from an origin mismatch — the form's allowed-origins list does not
 * include the page's origin. Misconfiguration, not a user error.
 */
export class OriginError extends SubmitPulseError {
  readonly kind = "origin" as const;
  constructor(message: string) {
    super(message);
    this.name = "OriginError";
  }
}

/**
 * The fetch call threw — typically a network failure, DNS error, or the request
 * was aborted (including our own timeout).
 */
export class NetworkError extends SubmitPulseError {
  readonly kind = "network" as const;
  /** The original fetch rejection, if available. */
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/** HTTP 5xx — the server faulted. Retryable. */
export class ServerError extends SubmitPulseError {
  readonly kind = "server" as const;
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ServerError";
    this.statusCode = statusCode;
  }
}
