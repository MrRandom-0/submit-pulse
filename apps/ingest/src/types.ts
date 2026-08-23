/**
 * Shared types for the ingest worker.
 *
 * Environment bindings are declared here and must match wrangler.toml.
 * Every external dependency is behind an interface — never referenced directly
 * in the pipeline modules so drivers can be swapped or mocked in tests.
 */

import type { RateLimiter } from "@submitpulse/security/rate-limit";
import type { CaptchaVerifier } from "@submitpulse/security/captcha";

// ---------------------------------------------------------------------------
// Cloudflare Worker env bindings
// ---------------------------------------------------------------------------

/**
 * Env vars and bindings injected by the Cloudflare runtime.
 * Must match [vars] and [[queues.producers]] in wrangler.toml.
 */
export interface Env {
  /** Cloudflare Queue for async submission processing. */
  readonly SUBMISSION_QUEUE: Queue<SubmissionQueueMessage>;

  /** KV namespace used for idempotency-key deduplication. */
  readonly IDEMPOTENCY_KV: KVNamespace;

  /**
   * D1 database for form lookups.
   * INCOMPLETE: a real DB client is wired here at deploy time.
   * The pipeline uses the FormRepository interface, not D1 directly.
   */
  readonly DB: D1Database;

  /** Cloudflare Turnstile secret key (SP_TURNSTILE_SECRET_KEY). */
  readonly SP_TURNSTILE_SECRET_KEY?: string;

  /** Upstash Redis REST URL (SP_UPSTASH_REDIS_REST_URL). */
  readonly SP_UPSTASH_REDIS_REST_URL?: string;

  /** Upstash Redis REST token (SP_UPSTASH_REDIS_REST_TOKEN). */
  readonly SP_UPSTASH_REDIS_REST_TOKEN?: string;

  /** "development" | "production" | "test" */
  readonly ENVIRONMENT?: string;
}

// ---------------------------------------------------------------------------
// Submission queue message schema
// ---------------------------------------------------------------------------

/**
 * Message shape enqueued after a successful ingestion.
 *
 * NOTE: Heavy work (email delivery, webhooks, AI spam analysis, file scanning)
 * is intentionally deferred to the queue consumer. The hot path only validates
 * and persists — it never calls external services that could add latency.
 */
export interface SubmissionQueueMessage {
  readonly submissionId: string;
  readonly formId: string;
  readonly workspaceId: string;
  readonly requestId: string;
  /** ISO 8601 timestamp the submission was accepted. */
  readonly acceptedAt: string;
}

// ---------------------------------------------------------------------------
// Form lookup result
// ---------------------------------------------------------------------------

export interface AllowedDomainRow {
  readonly host: string;
  readonly includeSubdomains: boolean;
}

export interface FormRow {
  readonly id: string;
  readonly publicId: string;
  readonly workspaceId: string;
  readonly status: "active" | "paused" | "archived";
  readonly captchaEnabled: boolean;
  readonly honeypotFieldName: string | null;
  readonly enforceOrigin: boolean;
  readonly allowLocalhost: boolean;
  readonly maxBodyBytes: number;
  readonly fileUploadsEnabled: boolean;
  readonly activeSchemaVersionId: string | null;
  readonly domains: readonly AllowedDomainRow[];
  readonly fields: readonly FormFieldRow[];
}

export interface FormFieldRow {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly constraints: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Repository interface (implemented per-driver; not hardcoded to D1)
// ---------------------------------------------------------------------------

export interface FormRepository {
  /** Look up form by public_id; returns null if not found or deleted. */
  findByPublicId(publicId: string): Promise<FormRow | null>;

  /**
   * Persist a new submission row.
   * Returns the internal UUID of the created row.
   */
  createSubmission(submission: NewSubmission): Promise<string>;

  /** Look up an existing submission by idempotency key. */
  findByIdempotencyKey(
    formId: string,
    key: string,
  ): Promise<ExistingSubmission | null>;
}

export interface NewSubmission {
  readonly formId: string;
  readonly workspaceId: string;
  readonly publicId: string;
  readonly requestId: string;
  readonly idempotencyKey: string | null;
  readonly origin: "live" | "test" | "synthetic";
  readonly data: Record<string, unknown>;
  readonly unexpectedData: Record<string, unknown> | null;
  readonly schemaVersionId: string | null;
  readonly spamVerdict: "clean" | "suspicious" | "spam" | "blocked";
  readonly spamScore: number;
  readonly ipAddress: string | null;
  readonly fingerprint: string | null;
  readonly userAgent: string | null;
  readonly referrer: string | null;
  readonly originHeader: string | null;
  readonly countryCode: string | null;
}

export interface ExistingSubmission {
  readonly id: string;
  readonly publicId: string;
  readonly requestId: string;
}

// ---------------------------------------------------------------------------
// Hono context variables
// ---------------------------------------------------------------------------

/** Variables attached to the Hono context for the duration of one request. */
export interface ContextVars {
  requestId: string;
  rateLimiter: RateLimiter;
  captchaVerifier: CaptchaVerifier;
  formRepository: FormRepository;
  /** Resolved form row, set by the form-lookup stage. */
  form?: FormRow;
  /** IP address extracted from CF headers. */
  clientIp: string;
}
