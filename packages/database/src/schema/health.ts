import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import {
  driftKindEnum,
  driftResolutionEnum,
  healthStatusEnum,
  incidentSeverityEnum,
  incidentStatusEnum,
} from "./enums";
import { forms, formSchemaVersions } from "./forms";
import { users, workspaces } from "./identity";
import { submissions } from "./submissions";

/* -------------------------------------------------------------------------- */
/* health_monitors                                                             */
/* -------------------------------------------------------------------------- */

/**
 * One monitor per form. Pulse periodically loads `targetUrl`, finds the form,
 * submits synthetic data, and verifies the end-to-end pipeline.
 *
 * SSRF NOTICE — `targetUrl` is USER-SUPPLIED and fetching it is SSRF-by-design.
 * Every fetch MUST go through the shared egress allowlist used by webhooks,
 * which blocks localhost, RFC-1918 / RFC-4193 private IP ranges, link-local
 * addresses (169.254.0.0/16), cloud metadata endpoints (169.254.169.254,
 * fd00:ec2::254, etc.), and IPv6 loopback. Re-validation after each redirect
 * hop is mandatory — a redirect to an internal address must be rejected even
 * when the initial URL is public. Allowlist enforcement belongs in
 * packages/security, not at this layer.
 */
export const healthMonitors = pgTable(
  "health_monitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    enabled: boolean("enabled").notNull().default(true),

    /** The deployed page to load during each synthetic run. Must be HTTPS. */
    targetUrl: text("target_url").notNull(),

    /** How often the monitor runs, in minutes. Clamped 5–1440 (one day). */
    intervalMinutes: integer("interval_minutes").notNull().default(30),

    currentStatus: healthStatusEnum("current_status")
      .notNull()
      .default("setup_incomplete"),

    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),

    /** Monotonically incrementing. Reset to 0 on any passing run. */
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),

    /** Rolling 30-day uptime percentage, maintained by the reporting worker. */
    uptimePercent30d: real("uptime_percent_30d"),

    /** Median end-to-end latency of recent successful runs, milliseconds. */
    avgLatencyMs: integer("avg_latency_ms"),

    notifyOnFailure: boolean("notify_on_failure").notNull().default(true),
    /** JSON array of email addresses to alert on failure. */
    notifyEmails: jsonb("notify_emails").$type<string[]>(),

    /** Set when the monitor is administratively paused. */
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedReason: text("paused_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One monitor per form; a second monitor for the same form would produce
    // duplicate synthetic submissions and confuse incident attribution.
    unique("health_monitors_form_id_key").on(t.formId),
    index("health_monitors_workspace_idx").on(t.workspaceId, t.currentStatus),
    check(
      "health_monitors_target_https",
      sql`${t.targetUrl} like 'https://%'`,
    ),
    check(
      "health_monitors_interval_range",
      sql`${t.intervalMinutes} between 5 and 1440`,
    ),
    check(
      "health_monitors_consecutive_failures_non_negative",
      sql`${t.consecutiveFailures} >= 0`,
    ),
    check(
      "health_monitors_uptime_range",
      sql`${t.uptimePercent30d} is null or ${t.uptimePercent30d} between 0 and 100`,
    ),
    check(
      "health_monitors_avg_latency_non_negative",
      sql`${t.avgLatencyMs} is null or ${t.avgLatencyMs} >= 0`,
    ),
    // paused_reason is only meaningful when a paused_at timestamp is present.
    check(
      "health_monitors_paused_consistency",
      sql`${t.pausedReason} is null or ${t.pausedAt} is not null`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* health_runs                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One row per synthetic test execution.
 *
 * BILLING EXCLUSION — the linked `syntheticSubmissionId` always points at a
 * submission with origin='synthetic'. That submission MUST be excluded from:
 *   • analytics and reporting aggregates
 *   • autoresponder triggers
 *   • third-party integration deliveries (webhooks, Zapier, etc.)
 *   • billable usage metering (submission volume limits, overage charges)
 * Billing the customer for Pulse's own monitoring traffic would be both
 * incorrect and a trust violation. The exclusion is enforced at the query
 * layer via the origin column on submissions, not via a separate flag here.
 */
export const healthRuns = pgTable(
  "health_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    healthMonitorId: uuid("health_monitor_id")
      .notNull()
      .references(() => healthMonitors.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),

    status: text("status").notNull(),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),

    /**
     * Ordered array of per-stage outcomes. Each element:
     *   name       — one of the canonical stage identifiers below
     *   ok         — whether this stage passed
     *   durationMs — wall time for the stage
     *   detail     — freeform string (error message, HTTP status, selector used)
     *
     * Canonical stage names: page_loaded, form_located, fields_matched,
     * endpoint_verified, submitted, api_accepted, processed, notified.
     */
    steps: jsonb("steps")
      .$type<
        Array<{
          name: string;
          ok: boolean;
          durationMs: number;
          detail?: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),

    /** The stage at which the run stopped making progress, if any. */
    failureStage: text("failure_stage"),
    failureReason: text("failure_reason"),

    /** HTTP status code returned when submitting to the form endpoint. */
    httpStatus: integer("http_status"),

    /**
     * The submission row produced by this run. Always origin='synthetic'.
     * Set null when the run failed before reaching the submission stage.
     */
    syntheticSubmissionId: uuid("synthetic_submission_id").references(
      () => submissions.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("health_runs_monitor_started_idx").on(
      t.healthMonitorId,
      t.startedAt.desc(),
    ),
    index("health_runs_workspace_started_idx").on(
      t.workspaceId,
      t.startedAt.desc(),
    ),
    check(
      "health_runs_status_known",
      sql`${t.status} in ('passed','failed','error','skipped')`,
    ),
    check(
      "health_runs_duration_non_negative",
      sql`${t.durationMs} is null or ${t.durationMs} >= 0`,
    ),
    check(
      "health_runs_completed_after_started",
      sql`${t.completedAt} is null or ${t.completedAt} >= ${t.startedAt}`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* incidents                                                                   */
/* -------------------------------------------------------------------------- */

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    /** Null when the incident was opened by a means other than Pulse (e.g. manually). */
    healthMonitorId: uuid("health_monitor_id").references(
      () => healthMonitors.id,
      { onDelete: "set null" },
    ),

    title: text("title").notNull(),
    summary: text("summary"),
    status: incidentStatusEnum("status").notNull().default("open"),
    severity: incidentSeverityEnum("severity").notNull().default("warning"),

    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedByUserId: uuid("acknowledged_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    /**
     * True when Pulse detected recovery and closed the incident without
     * human intervention. False when a user explicitly resolved it.
     */
    autoResolved: boolean("auto_resolved").notNull().default(false),

    /** The run that opened this incident. */
    firstFailedRunId: uuid("first_failed_run_id").references(
      () => healthRuns.id,
      { onDelete: "set null" },
    ),
    /** Updated on each subsequent failing run. */
    lastFailedRunId: uuid("last_failed_run_id").references(
      () => healthRuns.id,
      { onDelete: "set null" },
    ),

    /** Total number of consecutive failing runs attributed to this incident. */
    failureCount: integer("failure_count").notNull().default(1),

    /**
     * Append-only event log for this incident. Each entry:
     *   at      — ISO timestamp
     *   kind    — e.g. 'deployment_detected' | 'synthetic_test_failed' |
     *             'alert_sent' | 'repair_prompt_generated' | 'form_restored'
     *   message — human-readable description of the event
     */
    timeline: jsonb("timeline")
      .$type<Array<{ at: string; kind: string; message: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("incidents_workspace_status_idx").on(t.workspaceId, t.status),
    index("incidents_form_opened_idx").on(t.formId, t.openedAt.desc()),
    check(
      "incidents_failure_count_positive",
      sql`${t.failureCount} >= 1`,
    ),
    check(
      "incidents_acknowledged_after_opened",
      sql`${t.acknowledgedAt} is null or ${t.acknowledgedAt} >= ${t.openedAt}`,
    ),
    check(
      "incidents_resolved_after_opened",
      sql`${t.resolvedAt} is null or ${t.resolvedAt} >= ${t.openedAt}`,
    ),
    // Status transitions must be consistent with which timestamps are set.
    check(
      "incidents_status_timestamps_consistency",
      sql`
        (${t.status} = 'open' and ${t.resolvedAt} is null) or
        (${t.status} = 'acknowledged' and ${t.acknowledgedAt} is not null and ${t.resolvedAt} is null) or
        (${t.status} = 'resolved' and ${t.resolvedAt} is not null)
      `,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* schema_drift_events                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Records every instance where the observed form payload diverges from the
 * expected schema version.
 *
 * SAFETY INVARIANT — drift is NEVER auto-applied destructively. A 'field_removed'
 * or 'type_changed' event is informational; no data is dropped, no schema is
 * mutated, and no validation rules are loosened until a workspace member
 * explicitly reviews and accepts the change. This invariant must be preserved
 * at the application layer; nothing in this table enforces it.
 */
export const schemaDriftEvents = pgTable(
  "schema_drift_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    /**
     * The submission that first exposed this drift, if available.
     * Set null when the evidence submission is later purged by retention.
     */
    submissionId: uuid("submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),

    kind: driftKindEnum("kind").notNull(),
    resolution: driftResolutionEnum("resolution").notNull().default("unresolved"),

    /** The field whose definition changed or was added/removed, when applicable. */
    fieldName: text("field_name"),
    /** The schema definition before the change, serialised to JSON. */
    previousDefinition: jsonb("previous_definition").$type<Record<string, unknown>>(),
    /** What was actually observed in the submission payload. */
    observedDefinition: jsonb("observed_definition").$type<Record<string, unknown>>(),

    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    /** Schema version active at detection time. */
    fromSchemaVersionId: uuid("from_schema_version_id").references(
      () => formSchemaVersions.id,
      { onDelete: "set null" },
    ),
    /**
     * Schema version produced if the user accepted this drift.
     * Null until resolution is 'accepted' or 'mapped'.
     */
    toSchemaVersionId: uuid("to_schema_version_id").references(
      () => formSchemaVersions.id,
      { onDelete: "set null" },
    ),

    /**
     * How many times this exact drift pattern has been observed since
     * detection. Incremented by the worker rather than inserting duplicate rows.
     */
    occurrenceCount: integer("occurrence_count").notNull().default(1),

    /** The AI-generated prompt describing how to repair the form schema. */
    aiRepairPrompt: text("ai_repair_prompt"),
    aiRepairGeneratedAt: timestamp("ai_repair_generated_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("schema_drift_events_form_resolution_idx").on(t.formId, t.resolution),
    index("schema_drift_events_workspace_detected_idx").on(
      t.workspaceId,
      t.detectedAt.desc(),
    ),
    check(
      "schema_drift_events_occurrence_count_positive",
      sql`${t.occurrenceCount} >= 1`,
    ),
    check(
      "schema_drift_events_resolved_after_detected",
      sql`${t.resolvedAt} is null or ${t.resolvedAt} >= ${t.detectedAt}`,
    ),
    // to_schema_version_id should only be set when the drift was accepted or mapped.
    check(
      "schema_drift_events_to_version_consistency",
      sql`${t.toSchemaVersionId} is null or ${t.resolution} in ('accepted','mapped')`,
    ),
    // ai_repair_generated_at is only meaningful when a prompt was produced.
    check(
      "schema_drift_events_ai_repair_consistency",
      sql`${t.aiRepairGeneratedAt} is null or ${t.aiRepairPrompt} is not null`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* relations                                                                   */
/* -------------------------------------------------------------------------- */

export const healthMonitorsRelations = relations(
  healthMonitors,
  ({ one, many }) => ({
    form: one(forms, {
      fields: [healthMonitors.formId],
      references: [forms.id],
    }),
    workspace: one(workspaces, {
      fields: [healthMonitors.workspaceId],
      references: [workspaces.id],
    }),
    runs: many(healthRuns),
    incidents: many(incidents),
  }),
);

export const healthRunsRelations = relations(healthRuns, ({ one }) => ({
  healthMonitor: one(healthMonitors, {
    fields: [healthRuns.healthMonitorId],
    references: [healthMonitors.id],
  }),
  workspace: one(workspaces, {
    fields: [healthRuns.workspaceId],
    references: [workspaces.id],
  }),
  form: one(forms, {
    fields: [healthRuns.formId],
    references: [forms.id],
  }),
  syntheticSubmission: one(submissions, {
    fields: [healthRuns.syntheticSubmissionId],
    references: [submissions.id],
  }),
}));

export const incidentsRelations = relations(incidents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [incidents.workspaceId],
    references: [workspaces.id],
  }),
  form: one(forms, {
    fields: [incidents.formId],
    references: [forms.id],
  }),
  healthMonitor: one(healthMonitors, {
    fields: [incidents.healthMonitorId],
    references: [healthMonitors.id],
  }),
  acknowledgedBy: one(users, {
    fields: [incidents.acknowledgedByUserId],
    references: [users.id],
    relationName: "incident_acknowledger",
  }),
  resolvedBy: one(users, {
    fields: [incidents.resolvedByUserId],
    references: [users.id],
    relationName: "incident_resolver",
  }),
  firstFailedRun: one(healthRuns, {
    fields: [incidents.firstFailedRunId],
    references: [healthRuns.id],
    relationName: "incident_first_run",
  }),
  lastFailedRun: one(healthRuns, {
    fields: [incidents.lastFailedRunId],
    references: [healthRuns.id],
    relationName: "incident_last_run",
  }),
}));

export const schemaDriftEventsRelations = relations(
  schemaDriftEvents,
  ({ one }) => ({
    form: one(forms, {
      fields: [schemaDriftEvents.formId],
      references: [forms.id],
    }),
    workspace: one(workspaces, {
      fields: [schemaDriftEvents.workspaceId],
      references: [workspaces.id],
    }),
    submission: one(submissions, {
      fields: [schemaDriftEvents.submissionId],
      references: [submissions.id],
    }),
    resolvedBy: one(users, {
      fields: [schemaDriftEvents.resolvedByUserId],
      references: [users.id],
    }),
    fromSchemaVersion: one(formSchemaVersions, {
      fields: [schemaDriftEvents.fromSchemaVersionId],
      references: [formSchemaVersions.id],
      relationName: "drift_from_version",
    }),
    toSchemaVersion: one(formSchemaVersions, {
      fields: [schemaDriftEvents.toSchemaVersionId],
      references: [formSchemaVersions.id],
      relationName: "drift_to_version",
    }),
  }),
);
