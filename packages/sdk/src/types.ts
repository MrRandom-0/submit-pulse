/**
 * Core types for the Submit Pulse browser SDK.
 * Wire constants derive from @submitpulse/config/brand — do not hardcode strings.
 */

/** Options accepted by every submit call. */
export interface SubmitOptions {
  /**
   * Cloudflare Turnstile token, obtained client-side via window.turnstile.render.
   * Passed as-is; the API enforces presence when Turnstile is enabled on the form.
   */
  turnstileToken?: string;

  /**
   * Milliseconds before the request is aborted. Defaults to 30 000.
   * Pass 0 to disable the timeout entirely (not recommended for production).
   */
  timeoutMs?: number;

  /**
   * Idempotency key for this request. If omitted, idempotency is NOT guaranteed.
   * Use generateIdempotencyKey() from idempotency.ts to attach one automatically.
   * We do not auto-attach here because the caller must own the key lifecycle —
   * e.g. to retry with the SAME key, or to clear it after success.
   */
  idempotencyKey?: string;

  /**
   * Pass your own AbortSignal if you need to cancel from outside this library.
   * If both a timeout and an external signal are supplied, whichever fires first
   * wins — they are combined with AbortSignal.any (or a polyfill-free fallback).
   */
  signal?: AbortSignal;
}

/** Options passed to createClient. */
export interface CreateClientOptions {
  /**
   * Either a full submission endpoint URL or a publicFormId.
   * If publicFormId, baseUrl is combined with the canonical path template.
   * Providing endpoint directly lets callers who know their full URL skip the
   * baseUrl lookup entirely.
   */
  endpoint?: string;
  publicFormId?: string;

  /**
   * Override the API base URL. Useful in test environments.
   * Defaults to https://api.submitpulse.com.
   */
  baseUrl?: string;
}

/** Successful response from the API. */
export interface SubmitResult {
  /** Opaque submission ID (sub_…). */
  submissionId: string;
  /** The x-submitpulse-request-id header echoed back for tracing. */
  requestId: string | undefined;
}

/** Shape of the API's 422 validation error body. */
export interface ValidationErrorBody {
  errors: ValidationFieldError[];
}

/** Per-field error detail returned by the server. */
export interface ValidationFieldError {
  field: string;
  message: string;
  code?: string;
}
