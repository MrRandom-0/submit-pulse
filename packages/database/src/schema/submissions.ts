import { relations, sql } from "drizzle-orm";
import {
  bigint,
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
  fileScanStatusEnum,
  spamVerdictEnum,
  submissionOriginEnum,
  submissionStatusEnum,
} from "./enums";
import { forms, formSchemaVersions } from "./forms";
import { users, workspaces } from "./identity";

/* -------------------------------------------------------------------------- */
/* submissions                                                                 */
/* -------------------------------------------------------------------------- */

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Denormalised tenant key. Present so Row Level Security can filter without
     * a join to forms — RLS predicates that require joins are both slow and
     * easy to get subtly wrong.
     */
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),

    /** Public submission identifier returned to the caller. */
    publicId: text("public_id").notNull(),
    /** Correlates ingestion, queue and delivery logs for one request. */
    requestId: text("request_id").notNull(),

    /**
     * Client-supplied idempotency key. When present, a repeat POST with the
     * same key returns the original submission instead of creating a duplicate.
     */
    idempotencyKey: text("idempotency_key"),

    status: submissionStatusEnum("status").notNull().default("new"),
    origin: submissionOriginEnum("origin").notNull().default("live"),

    /** Validated payload, keyed by field wire name. */
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    /**
     * Fields present in the request but absent from the expected schema.
     * Retained separately so drift detection has evidence and so unexpected
     * input never silently merges into `data`.
     */
    unexpectedData: jsonb("unexpected_data").$type<Record<string, unknown>>(),

    schemaVersionId: uuid("schema_version_id").references(
      () => formSchemaVersions.id,
      { onDelete: "set null" },
    ),

    /* --- spam --- */
    spamVerdict: spamVerdictEnum("spam_verdict").notNull().default("clean"),
    spamScore: real("spam_score").notNull().default(0),

    /* --- provenance --- */
    /**
     * Truncated/normalised client IP. Stored for abuse control and subject to
     * the retention policy; see docs/26-privacy-data-retention.md.
     */
    ipAddress: text("ip_address"),
    /** SHA-256 of (ip + user agent + form). Used for repeat-payload detection. */
    fingerprint: text("fingerprint"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    originHeader: text("origin_header"),
    countryCode: text("country_code"),

    /* --- attribution --- */
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),

    /* --- triage --- */
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),

    /** Wall-clock milliseconds spent in the synchronous ingestion path. */
    processingMs: integer("processing_ms"),

    /** Soft delete so an accidental delete is recoverable within retention. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Set by the retention job; row becomes eligible for hard deletion. */
    purgeAfter: timestamp("purge_after", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("submissions_public_id_key").on(t.publicId),
    // Idempotency is scoped per form, and only enforced when a key is supplied.
    unique("submissions_idempotency_unique").on(t.formId, t.idempotencyKey),

    // Primary inbox query: newest-first within a form, excluding spam.
    index("submissions_form_created_idx").on(t.formId, t.createdAt.desc()),
    index("submissions_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt.desc(),
    ),
    index("submissions_form_status_idx").on(t.formId, t.status),
    index("submissions_spam_idx").on(t.formId, t.spamVerdict),
    index("submissions_fingerprint_idx").on(t.fingerprint, t.createdAt.desc()),
    index("submissions_request_id_idx").on(t.requestId),
    // Retention sweeper scans this.
    index("submissions_purge_idx").on(t.purgeAfter),
    // Full-text search over the payload for the inbox search box.
    index("submissions_data_gin_idx").using("gin", t.data),

    check("submissions_spam_score_range", sql`${t.spamScore} between 0 and 1`),
    check(
      "submissions_processing_ms_non_negative",
      sql`${t.processingMs} is null or ${t.processingMs} >= 0`,
    ),
    check(
      "submissions_country_shape",
      sql`${t.countryCode} is null or ${t.countryCode} ~ '^[A-Z]{2}$'`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* submission_events                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Append-only processing timeline for one submission: received, validated,
 * spam-checked, stored, queued, notified, webhook-delivered. Powers the
 * "processing timeline" in submission detail and is the primary debugging
 * surface when a customer asks why a lead never arrived.
 */
export const submissionEvents = pgTable(
  "submission_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    /** Machine-readable step name, e.g. "spam.evaluated". */
    kind: text("kind").notNull(),
    /** Human-readable summary for the timeline UI. */
    message: text("message"),
    /** Structured detail. Must never contain credentials. */
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    /** Duration of this step, when meaningful. */
    durationMs: integer("duration_ms"),
    /** Null for system events; set when a user caused the transition. */
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("submission_events_submission_idx").on(
      t.submissionId,
      t.createdAt.asc(),
    ),
    index("submission_events_kind_idx").on(t.kind, t.createdAt.desc()),
    check(
      "submission_events_duration_non_negative",
      sql`${t.durationMs} is null or ${t.durationMs} >= 0`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* submission_files                                                            */
/* -------------------------------------------------------------------------- */

export const submissionFiles = pgTable(
  "submission_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    /** Field the file arrived on. */
    fieldName: text("field_name").notNull(),
    /** Original client filename, retained for display only — never for storage. */
    originalFilename: text("original_filename").notNull(),
    /**
     * Server-generated storage key. Deliberately unrelated to the client
     * filename so a crafted name cannot influence the storage path.
     */
    storageKey: text("storage_key").notNull(),
    /** Bucket/container name, so storage can be migrated per-tenant. */
    storageBucket: text("storage_bucket").notNull(),

    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    /** MIME type as *detected server-side*, not as claimed by the client. */
    detectedMimeType: text("detected_mime_type").notNull(),
    declaredMimeType: text("declared_mime_type"),
    /** SHA-256 of the file content, for dedupe and integrity checks. */
    contentHash: text("content_hash").notNull(),

    scanStatus: fileScanStatusEnum("scan_status").notNull().default("pending"),
    scanCompletedAt: timestamp("scan_completed_at", { withTimezone: true }),
    scanResult: jsonb("scan_result").$type<{
      engine?: string;
      signature?: string;
      detail?: string;
    }>(),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("submission_files_storage_key_key").on(t.storageKey),
    index("submission_files_submission_idx").on(t.submissionId),
    index("submission_files_workspace_idx").on(t.workspaceId),
    index("submission_files_scan_idx").on(t.scanStatus),
    index("submission_files_purge_idx").on(t.purgeAfter),
    check("submission_files_size_positive", sql`${t.sizeBytes} > 0`),
    check(
      "submission_files_hash_shape",
      sql`${t.contentHash} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* submission_tags                                                             */
/* -------------------------------------------------------------------------- */

export const submissionTags = pgTable(
  "submission_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("submission_tags_unique").on(t.submissionId, t.tag),
    index("submission_tags_workspace_tag_idx").on(t.workspaceId, t.tag),
    check("submission_tags_shape", sql`length(${t.tag}) between 1 and 64`),
  ],
);

/* -------------------------------------------------------------------------- */
/* submission_notes                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Internal notes. Not part of the spec's table list, but the spec requires
 * "internal notes" in the inbox — storing them as rows rather than a text blob
 * on `submissions` keeps authorship and timestamps auditable.
 */
export const submissionNotes = pgTable(
  "submission_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("submission_notes_submission_idx").on(
      t.submissionId,
      t.createdAt.desc(),
    ),
    check("submission_notes_body_length", sql`length(${t.body}) between 1 and 10000`),
  ],
);

/* -------------------------------------------------------------------------- */
/* spam_decisions                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Why a submission was scored the way it was. The spec requires showing the
 * user an explanation ("Honeypot field populated", "Same payload submitted 19
 * times"), so the contributing signals are persisted rather than recomputed.
 */
export const spamDecisions = pgTable(
  "spam_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    verdict: spamVerdictEnum("verdict").notNull(),
    score: real("score").notNull(),
    /** Ordered list of contributing signals with individual weights. */
    signals: jsonb("signals")
      .$type<
        Array<{
          code: string;
          label: string;
          weight: number;
          evidence?: string;
        }>
      >()
      .notNull(),
    /** Set when a human overrides the automated verdict. */
    overriddenByUserId: uuid("overridden_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    overriddenAt: timestamp("overridden_at", { withTimezone: true }),
    overrideVerdict: spamVerdictEnum("override_verdict"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("spam_decisions_submission_key").on(t.submissionId),
    check("spam_decisions_score_range", sql`${t.score} between 0 and 1`),
    check(
      "spam_decisions_override_consistency",
      sql`(${t.overriddenAt} is null) = (${t.overrideVerdict} is null)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* spam_rules                                                                  */
/* -------------------------------------------------------------------------- */

export const spamRules = pgTable(
  "spam_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Null means the rule applies to every form in the workspace. */
    formId: uuid("form_id").references(() => forms.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    /** blocklist_term | blocklist_email | blocklist_ip | allowlist_email | regex */
    kind: text("kind").notNull(),
    /** Field to test; null means "any field". */
    targetField: text("target_field"),
    pattern: text("pattern").notNull(),
    /** Score contribution when matched. Negative values allowlist. */
    weight: real("weight").notNull().default(1),
    enabled: boolean("enabled").notNull().default(true),

    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
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
    index("spam_rules_workspace_idx").on(t.workspaceId, t.enabled),
    index("spam_rules_form_idx").on(t.formId),
    check(
      "spam_rules_kind_known",
      sql`${t.kind} in ('blocklist_term','blocklist_email','blocklist_ip','allowlist_email','regex')`,
    ),
    check("spam_rules_weight_range", sql`${t.weight} between -1 and 1`),
    check("spam_rules_pattern_length", sql`length(${t.pattern}) between 1 and 512`),
  ],
);

/* -------------------------------------------------------------------------- */
/* relations                                                                   */
/* -------------------------------------------------------------------------- */

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  form: one(forms, { fields: [submissions.formId], references: [forms.id] }),
  workspace: one(workspaces, {
    fields: [submissions.workspaceId],
    references: [workspaces.id],
  }),
  schemaVersion: one(formSchemaVersions, {
    fields: [submissions.schemaVersionId],
    references: [formSchemaVersions.id],
  }),
  events: many(submissionEvents),
  files: many(submissionFiles),
  tags: many(submissionTags),
  notes: many(submissionNotes),
  spamDecision: one(spamDecisions),
}));

export const submissionEventsRelations = relations(
  submissionEvents,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [submissionEvents.submissionId],
      references: [submissions.id],
    }),
  }),
);

export const submissionFilesRelations = relations(
  submissionFiles,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [submissionFiles.submissionId],
      references: [submissions.id],
    }),
  }),
);

export const spamDecisionsRelations = relations(spamDecisions, ({ one }) => ({
  submission: one(submissions, {
    fields: [spamDecisions.submissionId],
    references: [submissions.id],
  }),
}));
