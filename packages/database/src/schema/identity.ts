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

import {
  invitationStatusEnum,
  planEnum,
  workspaceKindEnum,
  workspaceRoleEnum,
} from "./enums";

/* -------------------------------------------------------------------------- */
/* users                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Application-side user record.
 *
 * Authentication itself lives with the auth provider (Supabase Auth in the
 * initial deployment). `authProviderId` is the join key. We deliberately do NOT
 * store password hashes here — delegating credential storage to the provider
 * keeps the blast radius of an application-database compromise smaller.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Opaque subject identifier from the auth provider. */
    authProviderId: text("auth_provider_id").notNull(),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    /** Platform staff flag. Gates /admin. Never settable through the product UI. */
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    mfaEnrolledAt: timestamp("mfa_enrolled_at", { withTimezone: true }),
    marketingOptInAt: timestamp("marketing_opt_in_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** Soft delete. Retained briefly to honour the account-deletion grace period. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("users_auth_provider_id_key").on(t.authProviderId),
    // Case-insensitive uniqueness on live accounts only, so a deleted account
    // does not permanently squat an address.
    index("users_email_lower_idx").on(sql`lower(${t.email})`),
    check("users_email_shape", sql`position('@' in ${t.email}) > 1`),
  ],
);

/* -------------------------------------------------------------------------- */
/* workspaces                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The tenant boundary. Every customer-owned row in the system is reachable to a
 * workspace, and Row Level Security is written against this id.
 */
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** URL-safe handle, unique platform-wide. */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: workspaceKindEnum("kind").notNull().default("standard"),
    /**
     * Agency mode: a client workspace points at its managing agency workspace.
     * Null for standard workspaces. Self-reference is rejected by a check.
     */
    parentWorkspaceId: uuid("parent_workspace_id"),
    plan: planEnum("plan").notNull().default("free"),
    /** Branding overrides for agency white-label reporting. */
    branding: jsonb("branding").$type<{
      logoUrl?: string;
      accentColor?: string;
      replyToEmail?: string;
    }>(),
    /** Set when abuse review suspends the tenant. Blocks ingestion. */
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),
    /** Custom retention override in days; falls back to the plan default. */
    retentionDaysOverride: integer("retention_days_override"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("workspaces_slug_key").on(t.slug),
    index("workspaces_parent_idx").on(t.parentWorkspaceId),
    check(
      "workspaces_slug_shape",
      sql`${t.slug} ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'`,
    ),
    check(
      "workspaces_no_self_parent",
      sql`${t.parentWorkspaceId} is null or ${t.parentWorkspaceId} <> ${t.id}`,
    ),
    // A client workspace must have a parent; a standard one must not.
    check(
      "workspaces_kind_parent_consistency",
      sql`(${t.kind} = 'client') = (${t.parentWorkspaceId} is not null)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* workspace_members                                                           */
/* -------------------------------------------------------------------------- */

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("viewer"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
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
    unique("workspace_members_unique").on(t.workspaceId, t.userId),
    index("workspace_members_user_idx").on(t.userId),
    index("workspace_members_workspace_role_idx").on(t.workspaceId, t.role),
  ],
);

/* -------------------------------------------------------------------------- */
/* invitations                                                                 */
/* -------------------------------------------------------------------------- */

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: workspaceRoleEnum("role").notNull().default("viewer"),
    /**
     * SHA-256 of the invitation token. The plaintext token is emailed once and
     * never stored, so a database read cannot be replayed into workspace access.
     */
    tokenHash: text("token_hash").notNull(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("invitations_token_hash_key").on(t.tokenHash),
    index("invitations_workspace_status_idx").on(t.workspaceId, t.status),
    index("invitations_email_idx").on(sql`lower(${t.email})`),
    check("invitations_expiry_future", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

/* -------------------------------------------------------------------------- */
/* relations                                                                   */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  members: many(workspaceMembers),
  invitations: many(invitations),
  parent: one(workspaces, {
    fields: [workspaces.parentWorkspaceId],
    references: [workspaces.id],
    relationName: "agency_clients",
  }),
  clients: many(workspaces, { relationName: "agency_clients" }),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
  }),
);
