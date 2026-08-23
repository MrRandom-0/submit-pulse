import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import {
  jobStatusEnum,
  planEnum,
  securityEventKindEnum,
  subscriptionStatusEnum,
} from "./enums";
import { forms } from "./forms";
import { users, workspaces } from "./identity";

/* -------------------------------------------------------------------------- */
/* api_keys                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Long-lived credentials for programmatic API access.
 *
 * SECURITY CONTRACT: the plaintext key is displayed exactly once at creation
 * and never recoverable; only the SHA-256 hash is stored. If the hash is
 * compromised the attacker still cannot reverse it to the original key.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    /** Non-secret visible prefix shown in the UI, e.g. 'submitpulse_live_a1b2'. */
    keyPrefix: text("key_prefix"),
    /** SHA-256 of the full plaintext key. The only persisted secret representation. */
    keyHash: text("key_hash").notNull(),
    scopes: jsonb("scopes").$type<string[]>(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    lastUsedIp: text("last_used_ip"),
    /** Null means the key does not expire. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("api_keys_key_hash_key").on(t.keyHash),
    index("api_keys_key_hash_idx").on(t.keyHash),
    index("api_keys_workspace_revoked_idx").on(t.workspaceId, t.revokedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* installation_tokens                                                         */
/* -------------------------------------------------------------------------- */

/**
 * SHORT-LIVED credentials issued to an AI coding agent during setup.
 *
 * Permitted operations:
 *   - Read public form configuration (name, allowed origins, field list)
 *   - Read the active form schema version
 *   - Generate code snippets and integration examples
 *   - Run a single test submission against the form endpoint
 *   - Validate that the generated integration resolves correctly
 *
 * MUST NEVER be used to:
 *   - Read, export, or enumerate real submission data
 *   - Access billing details, subscription status, or invoices
 *   - Read or modify workspace membership
 *   - Delete or archive a form
 *   - Mint permanent credentials (API keys or new installation tokens)
 *
 * Tokens are single-use-friendly (maxUses default 10) and short-lived
 * (expiresAt enforced by a CHECK). After expiry or revocation the token hash
 * cannot be used even if it was captured in transit.
 */
export const installationTokens = pgTable(
  "installation_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    issuedByUserId: uuid("issued_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** SHA-256 of the plaintext token. Plaintext delivered once to the agent. */
    tokenHash: text("token_hash"),
    scopes: jsonb("scopes").$type<string[]>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    useCount: integer("use_count").notNull().default(0),
    maxUses: integer("max_uses").notNull().default(10),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedIp: text("last_used_ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("installation_tokens_token_hash_key").on(t.tokenHash),
    check(
      "installation_tokens_expiry_after_creation",
      sql`${t.expiresAt} > ${t.createdAt}`,
    ),
    check(
      "installation_tokens_use_count_non_negative",
      sql`${t.useCount} >= 0`,
    ),
    check(
      "installation_tokens_max_uses_positive",
      sql`${t.maxUses} >= 1`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* usage_events                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Metering ledger. One row per billable or observable event.
 *
 * IMPORTANT: synthetic health-check submissions (origin = 'synthetic') must NOT
 * emit a 'submission_accepted' event. The worker is responsible for gating this
 * before writing to this table.
 */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Null for workspace-level events not tied to a specific form. */
    formId: uuid("form_id").references(() => forms.id, { onDelete: "set null" }),
    metric: text("metric").notNull(),
    quantity: integer("quantity").notNull().default(1),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    billingPeriodStart: date("billing_period_start"),
    /**
     * Caller-supplied idempotency key. Retries must not double-bill — the
     * unique constraint here is the enforcement mechanism.
     */
    idempotencyKey: text("idempotency_key"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("usage_events_idempotency_key_key").on(t.idempotencyKey),
    index("usage_events_workspace_metric_occurred_idx").on(
      t.workspaceId,
      t.metric,
      t.occurredAt.desc(),
    ),
    index("usage_events_workspace_billing_period_idx").on(
      t.workspaceId,
      t.billingPeriodStart,
    ),
    check(
      "usage_events_metric_known",
      sql`${t.metric} in ('submission_accepted','form_created','health_test','ai_analysis','storage_bytes','file_bandwidth_bytes','email_delivered','webhook_attempt','member_added')`,
    ),
    check("usage_events_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* subscriptions                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Billing subscription per workspace.
 *
 * Stripe webhooks are the authoritative source of truth for subscription status.
 * All writes from webhooks must be idempotent (check event id before mutating)
 * and must verify the Stripe-Signature header before trusting the payload.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    plan: planEnum("plan").notNull().default("free"),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    billingInterval: text("billing_interval"),
    seats: integer("seats").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("subscriptions_workspace_id_key").on(t.workspaceId),
    unique("subscriptions_stripe_subscription_id_key").on(
      t.stripeSubscriptionId,
    ),
    check(
      "subscriptions_billing_interval_known",
      sql`${t.billingInterval} is null or ${t.billingInterval} in ('month','year')`,
    ),
    check("subscriptions_seats_positive", sql`${t.seats} >= 1`),
  ],
);

/* -------------------------------------------------------------------------- */
/* audit_logs                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Append-only record of every consequential action in the system.
 *
 * This table is NEVER updated or deleted by application code. Retention is
 * handled by a separate archival job that moves rows to cold storage and
 * hard-deletes after the retention window. Application code may only INSERT.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Dot-namespaced action, e.g. 'form.deleted', 'api_key.revoked'. */
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    /** How the action was initiated. */
    actorType: text("actor_type").notNull(),
    /** Display label: user email, API key prefix, or system job name. */
    actorLabel: text("actor_label"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** Snapshot of the resource before the mutation. */
    before: jsonb("before").$type<Record<string, unknown>>(),
    /** Snapshot of the resource after the mutation. */
    after: jsonb("after").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_logs_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt.desc(),
    ),
    index("audit_logs_resource_idx").on(t.resourceType, t.resourceId),
    check(
      "audit_logs_actor_type_known",
      sql`${t.actorType} in ('user','api_key','system','support')`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* security_events                                                             */
/* -------------------------------------------------------------------------- */

export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null for events that precede workspace context (e.g. login failure). */
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: securityEventKindEnum("kind").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /**
     * Attempted email address on failed login. Retained briefly for
     * brute-force detection; purged by the retention job before long-term
     * archival to avoid storing third-party addresses indefinitely.
     */
    email: text("email"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    severity: text("severity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("security_events_kind_created_idx").on(t.kind, t.createdAt.desc()),
    index("security_events_ip_created_idx").on(
      t.ipAddress,
      t.createdAt.desc(),
    ),
    check(
      "security_events_severity_known",
      sql`${t.severity} in ('info','warning','critical')`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* feature_flags                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Platform-level feature flag registry. Not workspace-scoped — flags apply
 * globally or to an explicit allow-list of workspace ids.
 */
export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    description: text("description"),
    enabledGlobally: boolean("enabled_globally").notNull().default(false),
    /** Explicit workspace ids for targeted rollout before going global. */
    enabledWorkspaceIds: jsonb("enabled_workspace_ids").$type<string[]>(),
    /**
     * Percentage of workspaces (by id hash) that receive this flag when
     * enabledGlobally is false. 0 = nobody, 100 = everyone.
     */
    rolloutPercent: integer("rollout_percent").notNull().default(0),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("feature_flags_key_key").on(t.key),
    check(
      "feature_flags_rollout_range",
      sql`${t.rolloutPercent} between 0 and 100`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* background_jobs                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Durable queue mirror for admin visibility and dead-letter replay.
 *
 * The queue provider (e.g. BullMQ, Inngest) remains the execution authority.
 * This table mirrors job state so platform engineers can observe failures,
 * trigger replays, and audit dead-lettered jobs without direct queue access.
 * Writes here must never block the hot path — they are best-effort from the
 * worker and may lag the queue by seconds.
 */
export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queue: text("queue").notNull(),
    jobType: text("job_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    status: jobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    availableAt: timestamp("available_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    lastError: text("last_error"),
    /** Idempotency key so a retry from the queue does not create a second row. */
    idempotencyKey: text("idempotency_key"),
    /** Null for platform-level jobs not tied to a tenant. */
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    /** Wall-clock milliseconds the job ran for, when completed. */
    durationMs: integer("duration_ms"),
    deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("background_jobs_idempotency_key_key").on(t.idempotencyKey),
    index("background_jobs_status_available_idx").on(t.status, t.availableAt),
    index("background_jobs_queue_status_idx").on(t.queue, t.status),
    index("background_jobs_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt.desc(),
    ),
    check(
      "background_jobs_attempts_non_negative",
      sql`${t.attempts} >= 0`,
    ),
    check(
      "background_jobs_max_attempts_positive",
      sql`${t.maxAttempts} >= 1`,
    ),
    check(
      "background_jobs_duration_non_negative",
      sql`${t.durationMs} is null or ${t.durationMs} >= 0`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* relations                                                                   */
/* -------------------------------------------------------------------------- */

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiKeys.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [apiKeys.createdByUserId],
    references: [users.id],
    relationName: "api_key_creator",
  }),
  revokedByUser: one(users, {
    fields: [apiKeys.revokedByUserId],
    references: [users.id],
    relationName: "api_key_revoker",
  }),
}));

export const installationTokensRelations = relations(
  installationTokens,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [installationTokens.workspaceId],
      references: [workspaces.id],
    }),
    form: one(forms, {
      fields: [installationTokens.formId],
      references: [forms.id],
    }),
    issuedByUser: one(users, {
      fields: [installationTokens.issuedByUserId],
      references: [users.id],
    }),
  }),
);

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [usageEvents.workspaceId],
    references: [workspaces.id],
  }),
  form: one(forms, {
    fields: [usageEvents.formId],
    references: [forms.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [subscriptions.workspaceId],
    references: [workspaces.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [auditLogs.workspaceId],
    references: [workspaces.id],
  }),
  actorUser: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export const securityEventsRelations = relations(securityEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [securityEvents.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [securityEvents.userId],
    references: [users.id],
  }),
}));

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [featureFlags.updatedByUserId],
    references: [users.id],
  }),
}));

export const backgroundJobsRelations = relations(
  backgroundJobs,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [backgroundJobs.workspaceId],
      references: [workspaces.id],
    }),
  }),
);
