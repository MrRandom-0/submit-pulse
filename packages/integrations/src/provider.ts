/**
 * IntegrationProvider — contract every driver implements.
 *
 * Drivers are constructed with provider-specific config and credentials that
 * have already been decrypted by the caller (packages/security envelope
 * decryption). The driver must NOT fetch credentials from environment variables
 * at send time; they are passed at construction.
 */

/** Opaque event name from the submission pipeline, e.g. "submission.created". */
export type IntegrationEvent = string;

/** The submission payload forwarded to the integration. */
export type IntegrationPayload = Readonly<Record<string, unknown>>;

export type TestResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string; readonly detail?: string };

export type DeliveryResult =
  | {
      readonly ok: true;
      readonly providerRef?: string;
    }
  | {
      readonly ok: false;
      readonly retryable: boolean;
      readonly message: string;
      readonly detail?: string;
    };

/**
 * Every third-party integration driver implements this interface.
 *
 * Lifecycle:
 *   1. `connect()` — validate credentials, store any OAuth tokens returned.
 *   2. `test()` — lightweight API call to verify the connection is still live.
 *   3. `send()` — forward a submission event.
 *   4. `disconnect()` — revoke tokens / clean up.
 *
 * Drivers must be retry-safe: calling `send()` multiple times with the same
 * payload must not produce duplicate side-effects if the underlying API
 * supports idempotency. Document per-driver behaviour in each file.
 */
export interface IntegrationProvider {
  /**
   * Human-readable description of exactly what access the user is granting
   * when they connect this integration. Shown verbatim in the consent UI.
   * The spec requires this per integration — do not leave it generic.
   */
  readonly permissionExplanation: string;

  /**
   * Establish the connection. Called once when the user saves the integration.
   * May perform an OAuth exchange, validate an API key, etc.
   * Must throw `IntegrationConfigError` on missing / invalid config.
   */
  connect(config: IntegrationPayload): Promise<void>;

  /** Revoke access and clean up any stored tokens. */
  disconnect(): Promise<void>;

  /**
   * Perform a lightweight liveness check. Should make a real API call but
   * must NOT modify data (read-only or no-op endpoint).
   */
  test(): Promise<TestResult>;

  /**
   * Forward a submission event to the integration.
   *
   * @param event  The event name (e.g. "submission.created").
   * @param payload  The decrypted, sanitised submission payload.
   * @returns DeliveryResult — callers inspect `retryable` to decide queuing.
   */
  send(event: IntegrationEvent, payload: IntegrationPayload): Promise<DeliveryResult>;
}

/** Thrown when the driver is misconfigured (missing env var, bad credential). */
export class IntegrationConfigError extends Error {
  constructor(
    message: string,
    public readonly driver: string,
    public readonly missingField?: string,
  ) {
    super(message);
    this.name = "IntegrationConfigError";
  }
}

/** Thrown when the upstream API returns a permanent failure (4xx, not 429). */
export class IntegrationPermanentError extends Error {
  constructor(
    message: string,
    public readonly driver: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "IntegrationPermanentError";
  }
}
