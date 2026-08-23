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
  uuid,
} from "drizzle-orm/pg-core";

import { fieldTypeEnum, formStatusEnum, healthStatusEnum } from "./enums";
import { users, workspaces } from "./identity";

/* -------------------------------------------------------------------------- */
/* forms                                                                       */
/* -------------------------------------------------------------------------- */

export const forms = pgTable(
  "forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    /**
     * Public, unguessable form identifier used in the ingestion URL
     * (e.g. fm_7Kq2...). 128 bits of entropy, base62.
     *
     * SECURITY CONTRACT: this is NOT an authentication secret. A public form
     * endpoint is public by definition — anyone who can view the website's
     * HTML can read it. Enumeration resistance is the only property claimed.
     * Actual abuse control comes from origin rules, bot protection and rate
     * limits, never from the secrecy of this value.
     */
    publicId: text("public_id").notNull(),

    name: text("name").notNull(),
    /** The page this form is expected to live on. Drives Pulse Monitor. */
    websiteUrl: text("website_url"),
    status: formStatusEnum("status").notNull().default("active"),

    /** Denormalised health rollup so form lists render without a join. */
    healthStatus: healthStatusEnum("health_status")
      .notNull()
      .default("setup_incomplete"),

    /** Points at the schema version currently treated as expected. */
    activeSchemaVersionId: uuid("active_schema_version_id"),

    /** Bot protection. Optional per form, strongly recommended in the UI. */
    captchaEnabled: boolean("captcha_enabled").notNull().default(false),
    honeypotFieldName: text("honeypot_field_name"),

    /** Reject submissions whose Origin is not in form_domains. */
    enforceOrigin: boolean("enforce_origin").notNull().default(false),
    /** Permit localhost/127.0.0.1 origins for development. */
    allowLocalhost: boolean("allow_localhost").notNull().default(true),

    /** Hard ceiling for a single request body, bytes. Defence in depth. */
    maxBodyBytes: integer("max_body_bytes").notNull().default(1_048_576),
    fileUploadsEnabled: boolean("file_uploads_enabled").notNull().default(false),

    /** Redirect target after a non-AJAX HTML form post. Must be https. */
    successRedirectUrl: text("success_redirect_url"),

    /** Per-form override; falls back to workspace then plan default. */
    retentionDaysOverride: integer("retention_days_override"),

    /** Denormalised counters. Maintained by the worker, not the hot path. */
    submissionCount: integer("submission_count").notNull().default(0),
    spamBlockedCount: integer("spam_blocked_count").notNull().default(0),
    lastSubmissionAt: timestamp("last_submission_at", { withTimezone: true }),

    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("forms_public_id_key").on(t.publicId),
    index("forms_workspace_idx").on(t.workspaceId, t.status),
    index("forms_workspace_health_idx").on(t.workspaceId, t.healthStatus),
    check(
      "forms_public_id_shape",
      sql`${t.publicId} ~ '^fm_[A-Za-z0-9]{22,}$'`,
    ),
    check(
      "forms_max_body_sane",
      sql`${t.maxBodyBytes} between 1024 and 26214400`,
    ),
    check(
      "forms_redirect_https",
      sql`${t.successRedirectUrl} is null or ${t.successRedirectUrl} like 'https://%'`,
    ),
    check(
      "forms_retention_positive",
      sql`${t.retentionDaysOverride} is null or ${t.retentionDaysOverride} > 0`,
    ),
    check("forms_counts_non_negative", sql`${t.submissionCount} >= 0 and ${t.spamBlockedCount} >= 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* form_domains                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Allowed origins for a form. Stored normalised (scheme + host + optional
 * port, lowercased, no trailing slash) so comparison is exact rather than
 * fuzzy substring matching — `evil-example.com` must never match `example.com`.
 */
export const formDomains = pgTable(
  "form_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    /** Normalised host, e.g. "example.com". No scheme, no path. */
    host: text("host").notNull(),
    /** When true, matches any single-label subdomain of `host`. */
    includeSubdomains: boolean("include_subdomains").notNull().default(false),
    /** Marks platform preview domains (*.vercel.app etc.) for clearer UI. */
    isPreviewDomain: boolean("is_preview_domain").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("form_domains_unique").on(t.formId, t.host),
    index("form_domains_form_idx").on(t.formId),
    check("form_domains_host_lowercase", sql`${t.host} = lower(${t.host})`),
    check("form_domains_no_scheme", sql`${t.host} !~ '://'`),
    check("form_domains_no_path", sql`position('/' in ${t.host}) = 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* form_endpoints                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A form may expose more than one endpoint over its lifetime (for example when
 * rotating a public id after abuse). Keeping endpoints as rows preserves the
 * audit trail and lets an old endpoint be retired with a grace period rather
 * than breaking a live site instantly.
 */
export const formEndpoints = pgTable(
  "form_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    publicId: text("public_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(true),
    /** Set when rotated out. Requests still accepted until `retiresAt`. */
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    retiresAt: timestamp("retires_at", { withTimezone: true }),
    rotationReason: text("rotation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("form_endpoints_public_id_key").on(t.publicId),
    index("form_endpoints_form_idx").on(t.formId),
    check(
      "form_endpoints_retire_order",
      sql`${t.retiresAt} is null or ${t.retiredAt} is null or ${t.retiresAt} >= ${t.retiredAt}`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* form_schema_versions                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Immutable snapshot of the expected field set. Drift detection compares an
 * observed payload against the active version; submissions record the version
 * they validated against so historical data stays interpretable after a change.
 */
export const formSchemaVersions = pgTable(
  "form_schema_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    /** Canonical JSON of the field definitions at this version. */
    definition: jsonb("definition")
      .$type<{
        fields: Array<{
          name: string;
          type: string;
          required: boolean;
          constraints?: Record<string, unknown>;
        }>;
      }>()
      .notNull(),
    /** How this version came to exist. */
    source: text("source").notNull().default("manual"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("form_schema_versions_unique").on(t.formId, t.version),
    index("form_schema_versions_form_idx").on(t.formId, t.version),
    check("form_schema_versions_version_positive", sql`${t.version} >= 1`),
    check(
      "form_schema_versions_source_known",
      sql`${t.source} in ('manual','onboarding','inferred','drift_accepted','scanner')`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* form_fields                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The editable, current field set. `form_schema_versions` is the immutable
 * history; this table is what the UI edits and what validation reads.
 */
export const formFields = pgTable(
  "form_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    /** Wire name — the key expected in the submitted payload. */
    name: text("name").notNull(),
    label: text("label"),
    type: fieldTypeEnum("type").notNull().default("text"),
    required: boolean("required").notNull().default(false),
    position: integer("position").notNull().default(0),

    /** Type-specific constraints: min, max, pattern, allowed values, etc. */
    constraints: jsonb("constraints").$type<{
      min?: number;
      max?: number;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      allowedValues?: string[];
      maxFileCount?: number;
      maxFileSizeBytes?: number;
      allowedMimeTypes?: string[];
    }>(),

    /** Exclude from notification emails and exports (e.g. honeypot). */
    isInternal: boolean("is_internal").notNull().default(false),
    /** Redact in UI and exports — for fields carrying sensitive input. */
    isSensitive: boolean("is_sensitive").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("form_fields_unique_name").on(t.formId, t.name),
    index("form_fields_form_position_idx").on(t.formId, t.position),
    // Wire names must be safe to use as object keys and in exports.
    check("form_fields_name_shape", sql`${t.name} ~ '^[A-Za-z0-9_.\\[\\]-]{1,128}$'`),
    check("form_fields_position_non_negative", sql`${t.position} >= 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* relations                                                                   */
/* -------------------------------------------------------------------------- */

export const formsRelations = relations(forms, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [forms.workspaceId],
    references: [workspaces.id],
  }),
  domains: many(formDomains),
  endpoints: many(formEndpoints),
  fields: many(formFields),
  schemaVersions: many(formSchemaVersions),
}));

export const formDomainsRelations = relations(formDomains, ({ one }) => ({
  form: one(forms, { fields: [formDomains.formId], references: [forms.id] }),
}));

export const formFieldsRelations = relations(formFields, ({ one }) => ({
  form: one(forms, { fields: [formFields.formId], references: [forms.id] }),
}));

export const formSchemaVersionsRelations = relations(
  formSchemaVersions,
  ({ one }) => ({
    form: one(forms, {
      fields: [formSchemaVersions.formId],
      references: [forms.id],
    }),
  }),
);
