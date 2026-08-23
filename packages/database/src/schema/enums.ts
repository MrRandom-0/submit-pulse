import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Postgres enums. Kept in one module so migrations that add a variant are easy
 * to review — adding a value to a pg enum is non-transactional in older
 * Postgres versions and must be its own migration step.
 */

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "developer",
  "viewer",
]);

export const workspaceKindEnum = pgEnum("workspace_kind", [
  /** A normal customer workspace. */
  "standard",
  /** A client workspace nested under an agency workspace. */
  "client",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const formStatusEnum = pgEnum("form_status", [
  "active",
  "paused",
  "archived",
]);

export const fieldTypeEnum = pgEnum("field_type", [
  "text",
  "email",
  "phone",
  "number",
  "url",
  "date",
  "textarea",
  "select",
  "multiselect",
  "checkbox",
  "hidden",
  "file",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "new",
  "viewed",
  "qualified",
  "in_progress",
  "replied",
  "closed",
  "archived",
]);

/**
 * How a submission entered the system. `synthetic` submissions come from the
 * Pulse health monitor and must be excluded from analytics, autoresponders and
 * third-party integrations by default.
 */
export const submissionOriginEnum = pgEnum("submission_origin", [
  "live",
  "test",
  "synthetic",
]);

export const spamVerdictEnum = pgEnum("spam_verdict", [
  "clean",
  "suspicious",
  "spam",
  "blocked",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "queued",
  "sending",
  "sent",
  "delivered",
  "bounced",
  "failed",
  "skipped",
]);

export const healthStatusEnum = pgEnum("health_status", [
  "healthy",
  "degraded",
  "failing",
  "paused",
  "setup_incomplete",
]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "open",
  "acknowledged",
  "resolved",
]);

export const incidentSeverityEnum = pgEnum("incident_severity", [
  "critical",
  "warning",
  "info",
]);

export const driftKindEnum = pgEnum("drift_kind", [
  "field_added",
  "field_removed",
  "field_renamed",
  "type_changed",
  "required_changed",
  "validation_changed",
  "unexpected_payload",
]);

export const driftResolutionEnum = pgEnum("drift_resolution", [
  "unresolved",
  "accepted",
  "mapped",
  "ignored",
]);

export const fileScanStatusEnum = pgEnum("file_scan_status", [
  "pending",
  "scanning",
  "clean",
  "infected",
  "failed",
  "quarantined",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "dead_letter",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
]);

export const planEnum = pgEnum("plan", ["free", "starter", "pro", "agency"]);

export const integrationProviderEnum = pgEnum("integration_provider", [
  "slack",
  "discord",
  "telegram",
  "google_sheets",
  "airtable",
  "notion",
  "zapier",
  "make",
  "generic_webhook",
]);

export const securityEventKindEnum = pgEnum("security_event_kind", [
  "login_success",
  "login_failure",
  "password_reset_requested",
  "password_reset_completed",
  "mfa_enrolled",
  "mfa_challenge_failed",
  "session_revoked",
  "api_key_created",
  "api_key_revoked",
  "suspicious_activity",
  "rate_limit_tripped",
  "origin_rejected",
  "abuse_suspension",
]);
