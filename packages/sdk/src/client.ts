/**
 * Submit Pulse browser SDK — core client.
 *
 * Design goals:
 *  - Zero runtime dependencies (no axios, no lodash, no polyfills).
 *  - Works in every modern browser and in Node 18+.
 *  - File/FileList values are automatically serialised as multipart FormData;
 *    plain objects go as JSON. Callers never choose.
 *  - Structured, discriminated error types let consumers switch exhaustively.
 */

import { brand } from "@submitpulse/config/brand";

import {
  NetworkError,
  OriginError,
  RateLimitError,
  ServerError,
  SubmitPulseError,
  ValidationError,
} from "./errors.js";
import type {
  CreateClientOptions,
  SubmitOptions,
  SubmitResult,
  ValidationErrorBody,
} from "./types.js";

// ---------------------------------------------------------------------------
// Wire constants.
//
// Imported from the brand module by DEEP PATH rather than the config barrel,
// for two reasons:
//
//   1. Bundle size — the barrel also re-exports the integration-prompt and
//      snippet generators, which are large and server-only. Importing
//      "@submitpulse/config/brand" pulls in a dependency-free constants module
//      and nothing else, so the published SDK stays tiny.
//
//   2. Renameability — the product must be renameable by editing BRAND_SEED
//      alone. Hardcoding these as string literals silently breaks that
//      guarantee, and `pnpm brand:verify` fails the build on it.
// ---------------------------------------------------------------------------
const WIRE = {
  requestIdHeader: brand.wire.requestIdHeader,
  userAgent: brand.wire.userAgent,
} as const;

const DEFAULT_BASE_URL = brand.domains.api;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Max retries on network failure or 5xx.
 *
 * RETRY POLICY RATIONALE:
 *  - We ONLY retry on network failure and 5xx — these are transient conditions
 *    where the server may not have processed the request at all.
 *  - We NEVER retry on 4xx: those are definitive client errors (bad input,
 *    rate-limited, wrong origin). Retrying would just repeat the failure.
 *  - We NEVER retry a request that carries no idempotency key, because we
 *    cannot know whether the server already committed the first attempt. A
 *    double-submit would create two records.
 *  - Callers supply the idempotency key so they can reuse it across retries.
 */
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 200;

function resolveEndpoint(opts: CreateClientOptions): string {
  if (opts.endpoint !== undefined) {
    return opts.endpoint;
  }
  if (opts.publicFormId !== undefined) {
    const base = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    return `${base}/v1/forms/${opts.publicFormId}/submissions`;
  }
  throw new Error(
    "createClient requires either `endpoint` or `publicFormId`.",
  );
}

/** Returns true if the data contains at least one File or FileList value. */
function hasFileValues(data: Record<string, unknown>): boolean {
  for (const value of Object.values(data)) {
    if (
      (typeof File !== "undefined" && value instanceof File) ||
      (typeof FileList !== "undefined" && value instanceof FileList)
    ) {
      return true;
    }
  }
  return false;
}

/** Serialise plain data object → FormData for multipart upload. */
function toFormData(data: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (typeof File !== "undefined" && value instanceof File) {
      fd.append(key, value);
    } else if (typeof FileList !== "undefined" && value instanceof FileList) {
      for (let i = 0; i < value.length; i++) {
        const file = value.item(i);
        if (file !== null) fd.append(key, file);
      }
    } else if (value !== null && value !== undefined) {
      fd.append(key, String(value));
    }
  }
  return fd;
}

/** Combine two AbortSignals without relying on AbortSignal.any (Node 20+). */
function combineSignals(
  a: AbortSignal | undefined,
  b: AbortSignal,
): AbortSignal {
  if (a === undefined) return b;

  // AbortSignal.any is available in Node 20+ and modern browsers.
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([a, b]);
  }

  // Fallback: manual relay.
  const controller = new AbortController();
  const relay = (): void => controller.abort();
  a.addEventListener("abort", relay, { once: true });
  b.addEventListener("abort", relay, { once: true });
  return controller.signal;
}

/** Parse Retry-After header as seconds (integer or HTTP-date). */
function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) return undefined;
  const asInt = parseInt(header, 10);
  if (!isNaN(asInt)) return asInt;
  const asDate = Date.parse(header);
  if (!isNaN(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  return undefined;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The client object returned by createClient. */
export interface SubmitPulseClient {
  /**
   * Submit form data to the endpoint.
   *
   * @param data  Plain object whose values may include File/FileList —
   *              detected automatically; multipart is used when files are present.
   * @param opts  Per-call options (timeout, idempotency key, Turnstile token).
   */
  submit<T extends Record<string, unknown>>(
    data: T,
    opts?: SubmitOptions,
  ): Promise<SubmitResult>;
}

/**
 * Create a typed Submit Pulse client.
 *
 * @example
 * const client = createClient({ publicFormId: "fm_abc123" });
 * const result = await client.submit({ email: "user@example.com", message: "Hello" });
 */
export function createClient(opts: CreateClientOptions): SubmitPulseClient {
  const endpoint = resolveEndpoint(opts);

  async function submit<T extends Record<string, unknown>>(
    data: T,
    submitOpts?: SubmitOptions,
  ): Promise<SubmitResult> {
    const timeoutMs = submitOpts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const idempotencyKey = submitOpts?.idempotencyKey;
    const externalSignal = submitOpts?.signal;

    const useMultipart = hasFileValues(data as Record<string, unknown>);

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Each attempt gets its own AbortController for the timeout.
      // We recreate it per-attempt so a timed-out first attempt does not
      // poison the controller for the retry.
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutController = new AbortController();

      if (timeoutMs > 0) {
        timeoutId = setTimeout(
          () => timeoutController.abort(new Error("Request timed out")),
          timeoutMs,
        );
      }

      const signal = combineSignals(externalSignal, timeoutController.signal);

      const headers = new Headers();
      headers.set("User-Agent", WIRE.userAgent);
      // Accept is always JSON — the API returns JSON even for multipart posts.
      headers.set("Accept", "application/json");

      if (!useMultipart) {
        headers.set("Content-Type", "application/json");
      }
      if (idempotencyKey !== undefined) {
        headers.set("Idempotency-Key", idempotencyKey);
      }
      if (submitOpts?.turnstileToken !== undefined) {
        headers.set("X-Turnstile-Token", submitOpts.turnstileToken);
      }

      const body = useMultipart
        ? toFormData(data as Record<string, unknown>)
        : JSON.stringify(data);

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers,
          body,
          signal,
        });
      } catch (cause) {
        clearTimeout(timeoutId);

        // Decide whether to retry.
        // Network errors are transient. But we can only retry safely when an
        // idempotency key is present — without one we risk duplicate submissions.
        if (attempt < MAX_RETRIES && idempotencyKey !== undefined) {
          attempt++;
          await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }

        throw new NetworkError(
          cause instanceof Error ? cause.message : "Network request failed",
          cause,
        );
      }

      clearTimeout(timeoutId);

      const requestId =
        response.headers.get(WIRE.requestIdHeader) ?? undefined;

      // --- Success path ---
      if (response.ok) {
        const json = (await response.json()) as { id?: string };
        return {
          submissionId: json.id ?? "",
          requestId,
        };
      }

      // --- Error paths — parse body where possible ---
      const status = response.status;

      // 422 Validation — never retry.
      if (status === 422) {
        let fieldErrors: ValidationErrorBody["errors"] = [];
        try {
          const body = (await response.json()) as Partial<ValidationErrorBody>;
          fieldErrors = body.errors ?? [];
        } catch {
          // Malformed body; surface an empty field-error list.
        }
        throw new ValidationError("Submission validation failed", fieldErrors);
      }

      // 429 Rate limit — never retry autonomously; surface retryAfter.
      if (status === 429) {
        const retryAfter = parseRetryAfter(
          response.headers.get("Retry-After"),
        );
        throw new RateLimitError("Rate limit exceeded", retryAfter);
      }

      // 403 Origin mismatch — never retry; misconfiguration.
      if (status === 403) {
        throw new OriginError(
          "Request rejected: the page origin is not allowed for this form",
        );
      }

      // 4xx other — definitive failure; do not retry.
      if (status >= 400 && status < 500) {
        throw new SubmitPulseError_Generic(
          `Request failed with status ${status}`,
          status,
        );
      }

      // 5xx — transient server fault; retry if idempotency key is present.
      // Without a key we cannot know if the server committed the request,
      // so we surface the error immediately rather than risk a duplicate.
      if (status >= 500) {
        if (attempt < MAX_RETRIES && idempotencyKey !== undefined) {
          attempt++;
          await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        throw new ServerError(`Server error (${status})`, status);
      }

      // Unexpected status code — treat as a server error.
      throw new ServerError(`Unexpected status code ${status}`, status);
    }
  }

  return { submit };
}

// Internal: a generic 4xx wrapper that is not part of the public error union
// but still extends SubmitPulseError. Not exported — callers catch SubmitPulseError.
class SubmitPulseError_Generic extends SubmitPulseError {
  readonly kind = "server" as const;
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}
