/**
 * Typed webhook event payloads.
 *
 * Every payload carries a `version` field so consumers can migrate gracefully
 * when the shape changes. Increment the version string and add a migration note
 * here before deploying a breaking change.
 *
 * Current version: "v1"
 */

export type WebhookEventType =
  | "submission.created"
  | "submission.updated"
  | "submission.spam"
  | "submission.restored"
  | "form.health.failed"
  | "form.schema.changed";

/** All payloads share this envelope. */
export interface WebhookEnvelope<T extends WebhookEventType, D> {
  /** Payload schema version. Increment on breaking changes. */
  version: "v1";
  /** The event that fired. */
  event: T;
  /** ISO 8601 timestamp when the event was emitted. */
  createdAt: string;
  /** The workspace that owns the resource. */
  workspaceId: string;
  /** The form the event relates to. */
  formId: string;
  data: D;
}

/* -------------------------------------------------------------------------- */
/* submission.created                                                          */
/* -------------------------------------------------------------------------- */

export interface SubmissionCreatedData {
  submissionId: string;
  publicId: string;
  origin: string;
  spamVerdict: string;
  fields: Record<string, unknown>;
  submittedAt: string;
}

export type SubmissionCreatedPayload = WebhookEnvelope<
  "submission.created",
  SubmissionCreatedData
>;

/* -------------------------------------------------------------------------- */
/* submission.updated                                                          */
/* -------------------------------------------------------------------------- */

export interface SubmissionUpdatedData {
  submissionId: string;
  publicId: string;
  /** Fields that changed and their new values. */
  changes: Record<string, unknown>;
  updatedAt: string;
}

export type SubmissionUpdatedPayload = WebhookEnvelope<
  "submission.updated",
  SubmissionUpdatedData
>;

/* -------------------------------------------------------------------------- */
/* submission.spam                                                             */
/* -------------------------------------------------------------------------- */

export interface SubmissionSpamData {
  submissionId: string;
  publicId: string;
  spamVerdict: "spam" | "blocked";
  spamScore: number;
  signals: Array<{ code: string; label: string; weight: number; evidence?: string }>;
  detectedAt: string;
}

export type SubmissionSpamPayload = WebhookEnvelope<
  "submission.spam",
  SubmissionSpamData
>;

/* -------------------------------------------------------------------------- */
/* submission.restored                                                         */
/* -------------------------------------------------------------------------- */

export interface SubmissionRestoredData {
  submissionId: string;
  publicId: string;
  /** Who restored it ("user" or "system"). */
  restoredBy: string;
  restoredAt: string;
}

export type SubmissionRestoredPayload = WebhookEnvelope<
  "submission.restored",
  SubmissionRestoredData
>;

/* -------------------------------------------------------------------------- */
/* form.health.failed                                                          */
/* -------------------------------------------------------------------------- */

export interface FormHealthFailedData {
  healthMonitorId: string;
  healthRunId: string;
  failureStage: string;
  failureReason: string;
  consecutiveFailures: number;
  incidentId?: string;
  failedAt: string;
}

export type FormHealthFailedPayload = WebhookEnvelope<
  "form.health.failed",
  FormHealthFailedData
>;

/* -------------------------------------------------------------------------- */
/* form.schema.changed                                                         */
/* -------------------------------------------------------------------------- */

export interface FormSchemaChangedData {
  schemaDriftEventId: string;
  kind: string;
  fieldName?: string;
  previousDefinition?: Record<string, unknown>;
  observedDefinition?: Record<string, unknown>;
  detectedAt: string;
}

export type FormSchemaChangedPayload = WebhookEnvelope<
  "form.schema.changed",
  FormSchemaChangedData
>;

/* -------------------------------------------------------------------------- */
/* Union                                                                       */
/* -------------------------------------------------------------------------- */

export type AnyWebhookPayload =
  | SubmissionCreatedPayload
  | SubmissionUpdatedPayload
  | SubmissionSpamPayload
  | SubmissionRestoredPayload
  | FormHealthFailedPayload
  | FormSchemaChangedPayload;
