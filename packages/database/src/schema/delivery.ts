import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  deliveryStatusEnum,
  integrationProviderEnum,
} from "./enums";
import { forms } from "./forms";
import { users, workspaces } from "./identity";
import { submissions } from "./submissions";

/* -------------------------------------------------------------------------- */
/* email_destinations                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Notification recipients configured per form. Each row is one email address
 * that should receive a copy of every (non-spam, non-synthetic) submission.
 *
 * `verifiedAt` follows the same pattern as user email verification: we send a
 * challenge link and only mark the address confirmed on click, so typos and
 * spoofed addresses do not silently receive customer data.
 *
 * `includedFields` is null when all fields should be forwarded; a non-null
 * array acts as an allowlist so sensitive fields can be excluded per-recipient.
 */
export const emailDestinations = pgTable(
  "email_destinations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    /** Human-readable label for the UI ("Sales team", "Support alias"). */
    label: text("label"),
    /** Set when the address has been confirmed via the verification flow. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    /** Handlebars-style subject line; {{fieldName}} tokens are expanded. */
    subjectTemplate: text("subject_template"),
    /**
     * Name of the submitted field whose value becomes the Reply-To header.
     * Lets recipients hit "reply" in their email client and reach the submitter
     * directly, without exposing their address in the To/From headers.
     */
    replyToFieldName: text("reply_to_field_name"),
    /**
     * Allowlist of field names to include in the notification body.
     * Null means all non-internal fields are forwarded.
     */
    includedFields: jsonb("included_fields").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("email_destinations_form_email_key").on(t.formId, t.email),
    index("email_destinations_workspace_idx").on(t.workspaceId),
    // Basic structural check; full RFC 5322 validation belongs in the application layer.
    check("email_destinations_email_shape", sql`position('@' in ${t.email}) > 1`),
  ],
);

/* -------------------------------------------------------------------------- */
/* email_deliveries                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Append-only log of every attempted email send. One row per attempt, so
 * retries produce additional rows rather than mutating the previous one —
 * this preserves the full delivery history for debugging and audit.
 *
 * `idempotencyKey` is the mechanism that prevents a retry storm from sending
 * the same notification multiple times: the worker checks for an existing row
 * with the same key before enqueuing.
 */
export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /**
     * Nullable because the destination config may be deleted after the email
     * was sent; we keep the delivery record for audit regardless.
     */
    emailDestinationId: uuid("email_destination_id").references(
      () => emailDestinations.id,
      { onDelete: "set null" },
    ),
    status: deliveryStatusEnum("status").notNull().default("queued"),
    /**
     * Broad category of why this email was sent. Drives filtering in the
     * delivery log UI and is used to route unsubscribe / suppression logic:
     * billing and incident emails bypass marketing suppressions, for example.
     */
    kind: text("kind").notNull(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    /** Opaque message ID returned by the upstream email provider (e.g. SendGrid). */
    providerMessageId: text("provider_message_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    /**
     * Stable key derived from (submissionId, destinationId, kind) so that
     * worker crashes or queue redeliveries cannot cause duplicate sends.
     * The worker inserts with ON CONFLICT DO NOTHING keyed on this column.
     */
    idempotencyKey: text("idempotency_key").notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("email_deliveries_idempotency_key_key").on(t.idempotencyKey),
    index("email_deliveries_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt.desc(),
    ),
    index("email_deliveries_status_idx").on(t.status),
    index("email_deliveries_submission_idx").on(t.submissionId),
    check(
      "email_deliveries_kind_known",
      sql`${t.kind} in ('notification','autoresponder','verification','invitation','billing','incident')`,
    ),
    check(
      "email_deliveries_attempt_count_non_negative",
      sql`${t.attemptCount} >= 0`,
    ),
    check(
      "email_deliveries_to_email_shape",
      sql`position('@' in ${t.toEmail}) > 1`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* autoresponders                                                              */
/* -------------------------------------------------------------------------- */

/**
 * One autoresponder per form. When a submission arrives and the conditions
 * match, the worker sends a personalised reply to the submitter's own address.
 *
 * SAFETY CONTRACT: autoresponders MUST be skipped for any submission whose
 * origin is 'synthetic' (Pulse health checks) or whose spam_verdict is
 * 'spam'/'blocked'. Sending to synthetic submissions would create mail loops
 * with the health-check system; sending to spam submissions rewards abuse and
 * may get the platform's sending IPs blocklisted.
 *
 * `toFieldName` is mandatory: the system cannot guess which field holds the
 * submitter's address, and an autoresponder with no destination is a
 * misconfiguration rather than a recoverable error.
 */
export const autoresponders = pgTable(
  "autoresponders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    /** Sender display name shown in the email client. */
    fromName: text("from_name"),
    /**
     * Reply-To address for the autoresponder itself. Should be a monitored
     * inbox — if the submitter replies to the autoresponder it goes here.
     * Must not be set to a no-reply address that will auto-reply back, as
     * that would create a mail loop.
     */
    replyToEmail: text("reply_to_email"),
    /**
     * Wire name of the submitted field that holds the recipient address.
     * Required: there is no safe default.
     */
    toFieldName: text("to_field_name").notNull(),
    /**
     * Seconds to wait before sending. Useful for drip sequences or to avoid
     * sending before the submitter has finished their session.
     */
    delaySeconds: integer("delay_seconds").notNull().default(0),
    /**
     * JSON expression tree evaluated against the submission payload to decide
     * whether to send. Null means "always send". The evaluator lives in
     * packages/rules and is the single source of truth for the schema.
     */
    conditions: jsonb("conditions").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Enforces the one-autoresponder-per-form constraint at the database level.
    unique("autoresponders_form_id_key").on(t.formId),
    index("autoresponders_workspace_idx").on(t.workspaceId),
    check(
      "autoresponders_delay_non_negative",
      sql`${t.delaySeconds} >= 0`,
    ),
    check(
      "autoresponders_has_body",
      sql`${t.bodyHtml} is not null or ${t.bodyText} is not null`,
    ),
    check(
      "autoresponders_reply_to_shape",
      sql`${t.replyToEmail} is null or position('@' in ${t.replyToEmail}) > 1`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* webhook_endpoints                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Customer-configured outbound webhook targets.
 *
 * `secretHash` stores a bcrypt/argon2 hash of the HMAC signing secret;
 * the plaintext is shown exactly once at creation time in the UI and never
 * persisted. This means a database read cannot be used to forge webhook
 * signatures.
 *
 * SSRF note: the CHECK constraint here only enforces the https:// scheme.
 * Full SSRF validation — blocking 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12,
 * 192.168.0.0/16, metadata endpoints (169.254.169.254), and IPv6 loopback —
 * is performed at request time in packages/security, not here. A database
 * CHECK cannot protect against DNS rebinding attacks where a hostname resolves
 * to a public IP at validation time but to a private IP at delivery time.
 */
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /**
     * Null means this endpoint receives events for every form in the workspace.
     * A non-null formId scopes it to a single form.
     */
    formId: uuid("form_id").references(() => forms.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    description: text("description"),
    /**
     * Hashed HMAC signing secret. Plaintext is shown once at creation only
     * and is never stored anywhere in the system. Treat this column as opaque.
     */
    secretHash: text("secret_hash").notNull(),
    /**
     * JSON string array of event names this endpoint subscribes to,
     * e.g. ["submission.created", "submission.spam_detected"].
     * Null or empty means subscribe to all events.
     */
    events: jsonb("events").$type<string[]>(),
    enabled: boolean("enabled").notNull().default(true),
    /** Payload envelope version. Increment when the shape changes to allow consumers to migrate. */
    payloadVersion: text("payload_version").notNull().default("v1"),
    /**
     * Incremented on each delivery failure; reset to 0 on success.
     * The worker auto-disables the endpoint (sets disabledAt) after a
     * configurable threshold so a dead endpoint does not consume queue budget.
     */
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    /** Set when the endpoint is auto-disabled due to repeated failures. */
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("webhook_endpoints_workspace_idx").on(t.workspaceId, t.enabled),
    index("webhook_endpoints_form_idx").on(t.formId),
    // See module comment: private-range blocking is enforced at request time, not here.
    check(
      "webhook_endpoints_url_https",
      sql`${t.url} like 'https://%'`,
    ),
    check(
      "webhook_endpoints_consecutive_failures_non_negative",
      sql`${t.consecutiveFailures} >= 0`,
    ),
    check(
      "webhook_endpoints_payload_version_shape",
      sql`${t.payloadVersion} ~ '^v[0-9]+$'`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* webhook_deliveries                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Append-only record of every outbound webhook attempt. One row per attempt;
 * retries produce new rows.
 *
 * `responseBodySnippet` is capped to a short prefix (e.g. 512 bytes) before
 * storing. Storing the full response body would allow a malicious endpoint to
 * cause unbounded database growth by responding with arbitrarily large payloads
 * and is a denial-of-service vector against the platform's storage budget.
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookEndpointId: uuid("webhook_endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /**
     * Nullable: the originating submission may be deleted (e.g. by retention)
     * after the delivery was attempted.
     */
    submissionId: uuid("submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),
    status: deliveryStatusEnum("status").notNull().default("queued"),
    /**
     * The value sent as the X-Webhook-Delivery-ID header. Exposed to
     * customers so they can correlate their server logs with this table.
     */
    deliveryId: text("delivery_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    /** Outgoing headers, for debugging. Must not contain the raw signing secret. */
    requestHeaders: jsonb("request_headers").$type<Record<string, string>>(),
    /** HTTP status code returned by the endpoint, null if no response received. */
    responseStatus: integer("response_status"),
    /**
     * First N bytes of the response body. Capped to prevent huge-response DoS;
     * the truncation limit is enforced in the delivery worker before this row
     * is written.
     */
    responseBodySnippet: text("response_body_snippet"),
    /** Round-trip time in milliseconds. */
    durationMs: integer("duration_ms"),
    attemptCount: integer("attempt_count").notNull().default(0),
    /** When the retry sweeper should next pick this delivery up. */
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("webhook_deliveries_delivery_id_key").on(t.deliveryId),
    index("webhook_deliveries_endpoint_created_idx").on(
      t.webhookEndpointId,
      t.createdAt.desc(),
    ),
    // The retry sweeper polls this index to find deliveries that are due.
    index("webhook_deliveries_next_retry_idx").on(t.nextRetryAt),
    index("webhook_deliveries_status_idx").on(t.status),
    check(
      "webhook_deliveries_attempt_count_non_negative",
      sql`${t.attemptCount} >= 0`,
    ),
    check(
      "webhook_deliveries_duration_non_negative",
      sql`${t.durationMs} is null or ${t.durationMs} >= 0`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* integrations                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Third-party service connections (Slack, Google Sheets, Airtable, etc.).
 *
 * `credentials` holds OAuth tokens, API keys, or other provider-specific
 * secrets. THIS COLUMN MUST BE ENCRYPTED AT REST using the envelope encryption
 * scheme in packages/security before being written and decrypted after being
 * read. Never store plaintext tokens in this column. The application layer is
 * responsible for this — the database has no way to enforce it.
 *
 * `config` holds non-secret provider settings (target sheet ID, channel name,
 * mapping rules) and is stored unencrypted.
 *
 * The unique constraint on (workspaceId, provider, formId) is intentionally
 * nullable-aware: two rows with formId IS NULL and the same provider in the
 * same workspace are not permitted, which enforces one workspace-level
 * integration per provider.
 */
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /**
     * Null means the integration applies workspace-wide. Non-null scopes it
     * to a specific form, allowing per-form routing to different destinations.
     */
    formId: uuid("form_id").references(() => forms.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    displayName: text("display_name").notNull(),
    /**
     * Envelope-encrypted provider credentials (tokens, keys, secrets).
     * The plaintext MUST NEVER be stored here. See packages/security for the
     * encryption API. Rotate the data-encryption key via the key management
     * service, not by updating this column directly.
     */
    credentials: jsonb("credentials").$type<Record<string, unknown>>(),
    /** Non-secret provider configuration: target IDs, field mappings, etc. */
    config: jsonb("config").$type<Record<string, unknown>>(),
    enabled: boolean("enabled").notNull().default(true),
    /** Timestamp of the most recent connectivity test. */
    lastTestAt: timestamp("last_test_at", { withTimezone: true }),
    /** Whether the most recent connectivity test succeeded. */
    lastTestOk: boolean("last_test_ok"),
    lastErrorText: text("last_error_text"),
    /**
     * The workspace member who connected the integration. Retained for audit;
     * set null if the user account is deleted rather than cascading, because
     * the integration itself should survive the user's departure.
     */
    connectedByUserId: uuid("connected_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /*
     * Uniqueness is split into two PARTIAL indexes rather than one composite
     * UNIQUE(workspace_id, provider, form_id).
     *
     * Postgres treats NULLs as DISTINCT in a unique constraint, so a plain
     * composite unique would happily accept two workspace-level rows (form_id
     * IS NULL) for the same provider — i.e. two Slack integrations both
     * claiming every form in the workspace, with non-deterministic delivery.
     *
     * `NULLS NOT DISTINCT` (PG15+) would also work, but partial indexes state
     * the intent explicitly and remain valid on PG14.
     */
    uniqueIndex("integrations_workspace_provider_global_key")
      .on(t.workspaceId, t.provider)
      .where(sql`${t.formId} is null`),
    uniqueIndex("integrations_workspace_provider_form_key")
      .on(t.workspaceId, t.provider, t.formId)
      .where(sql`${t.formId} is not null`),
    index("integrations_workspace_idx").on(t.workspaceId, t.enabled),
    index("integrations_form_idx").on(t.formId),
  ],
);

/* -------------------------------------------------------------------------- */
/* relations                                                                   */
/* -------------------------------------------------------------------------- */

export const emailDestinationsRelations = relations(
  emailDestinations,
  ({ one, many }) => ({
    form: one(forms, {
      fields: [emailDestinations.formId],
      references: [forms.id],
    }),
    workspace: one(workspaces, {
      fields: [emailDestinations.workspaceId],
      references: [workspaces.id],
    }),
    deliveries: many(emailDeliveries),
  }),
);

export const emailDeliveriesRelations = relations(
  emailDeliveries,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [emailDeliveries.submissionId],
      references: [submissions.id],
    }),
    workspace: one(workspaces, {
      fields: [emailDeliveries.workspaceId],
      references: [workspaces.id],
    }),
    emailDestination: one(emailDestinations, {
      fields: [emailDeliveries.emailDestinationId],
      references: [emailDestinations.id],
    }),
  }),
);

export const autorespondersRelations = relations(autoresponders, ({ one }) => ({
  form: one(forms, {
    fields: [autoresponders.formId],
    references: [forms.id],
  }),
  workspace: one(workspaces, {
    fields: [autoresponders.workspaceId],
    references: [workspaces.id],
  }),
}));

export const webhookEndpointsRelations = relations(
  webhookEndpoints,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [webhookEndpoints.workspaceId],
      references: [workspaces.id],
    }),
    form: one(forms, {
      fields: [webhookEndpoints.formId],
      references: [forms.id],
    }),
    deliveries: many(webhookDeliveries),
  }),
);

export const webhookDeliveriesRelations = relations(
  webhookDeliveries,
  ({ one }) => ({
    webhookEndpoint: one(webhookEndpoints, {
      fields: [webhookDeliveries.webhookEndpointId],
      references: [webhookEndpoints.id],
    }),
    workspace: one(workspaces, {
      fields: [webhookDeliveries.workspaceId],
      references: [workspaces.id],
    }),
    submission: one(submissions, {
      fields: [webhookDeliveries.submissionId],
      references: [submissions.id],
    }),
  }),
);

export const integrationsRelations = relations(integrations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [integrations.workspaceId],
    references: [workspaces.id],
  }),
  form: one(forms, {
    fields: [integrations.formId],
    references: [forms.id],
  }),
  connectedByUser: one(users, {
    fields: [integrations.connectedByUserId],
    references: [users.id],
  }),
}));
