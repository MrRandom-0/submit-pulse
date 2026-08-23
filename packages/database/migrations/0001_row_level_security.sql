-- =============================================================================
-- Migration: 0001_row_level_security.sql
-- Submit Pulse — Row Level Security Policies
-- =============================================================================
--
-- THREAT MODEL
-- ------------
-- This migration implements the LAST LINE OF DEFENCE for tenant isolation.
--
-- The application layer (packages/auth/src/permissions.ts) is the PRIMARY
-- authorisation gate. Every request should already be rejected there before
-- reaching the database. RLS exists because that layer WILL eventually contain
-- a bug — a forgotten auth check, a misconfigured middleware, a SSRF that
-- bypasses normal routing, or a direct database connection from a compromised
-- service. RLS ensures that even when the application layer is fully bypassed,
-- a tenant cannot read or mutate another tenant's data.
--
-- WORKER BYPASS DESIGN
-- --------------------
-- The ingestion worker and background worker connect as `sp_service` which has
-- BYPASSRLS. This is intentional: workers operate across tenants by design
-- (e.g. the retention job deletes expired rows from ALL workspaces; the delivery
-- worker fans out notifications across tenants). This role MUST NEVER be
-- reachable from user-facing code paths. It must not appear in connection string
-- environment variables accessible to web/API processes. Audit the connection
-- pool configuration in every deployment environment to enforce this separation.
-- If user-facing code ever connects as sp_service, RLS provides no protection.
--
-- POLICY COVERAGE
-- ---------------
-- Every workspace-scoped table in the schema is listed explicitly below.
-- Missing a table is a tenant-isolation vulnerability. Tables are grouped by
-- schema file. Any table added to the schema in the future MUST have a
-- corresponding RLS section added here before it reaches production.
--
-- =============================================================================


-- =============================================================================
-- SECTION 1: DATABASE ROLES
-- =============================================================================

-- sp_app  — Authenticated application role. RLS is enforced for this role.
--           Web server and API processes connect as this role. It must never
--           have SUPERUSER, CREATEROLE, or BYPASSRLS attributes.
--
-- sp_service — Ingestion worker, background worker, and internal platform jobs.
--              BYPASSRLS is granted deliberately so workers can operate across
--              all tenants. This role must be kept off all user-facing connection
--              pools. Grant only the table-level permissions workers actually need.
--
-- sp_analytics — Read-only role for analytics/BI tooling. RLS is enforced, so
--                this role can only see rows the session context permits. In
--                practice this role is used with a NULL workspace context for
--                platform-level dashboards — meaning it sees NOTHING unless a
--                trusted caller sets app.workspace_id first and that workspace_id
--                corresponds to a real membership. Analytics queries that
--                legitimately need cross-tenant access should connect as sp_service.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sp_app') THEN
    CREATE ROLE sp_app NOLOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sp_service') THEN
    CREATE ROLE sp_service NOLOGIN BYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sp_analytics') THEN
    CREATE ROLE sp_analytics NOLOGIN;
  END IF;
END
$$;


-- =============================================================================
-- SECTION 2: TENANT CONTEXT MECHANISM
-- =============================================================================
--
-- We use PostgreSQL session-local settings (current_setting) to carry the
-- current workspace and user identities through the connection. The application
-- layer sets these at the start of every request:
--
--   SET LOCAL app.workspace_id = '<uuid>';
--   SET LOCAL app.user_id      = '<uuid>';
--
-- SET LOCAL scopes the value to the current transaction. This is important:
-- if the application uses a connection pool that reuses connections across
-- requests, a plain SET (session-level) would leak one tenant's context into
-- the next request on that connection. SET LOCAL is automatically cleared at
-- COMMIT or ROLLBACK, so there is no carry-over risk.
--
-- The helper functions use `missing_ok => true` (the boolean second argument).
-- This causes current_setting to return NULL rather than raising an error when
-- the setting has never been assigned on this connection. We return NULL rather
-- than raising for two reasons:
--
--   1. It keeps the helper STABLE (no ERROR side-effects), which allows
--      PostgreSQL to optimise the predicate evaluation correctly.
--
--   2. All policies are written to DENY when the context is NULL. A NULL
--      workspace_id in the USING predicate evaluates FALSE, so no rows are
--      visible. A NULL check in WITH CHECK also evaluates FALSE, so no inserts
--      or updates succeed. Returning NULL is therefore a safe-fail: a connection
--      that has not set the context variables sees NOTHING and can write NOTHING.
--      Raising an exception would be equally secure, but would produce noisier
--      error messages and could expose internal implementation details.

CREATE OR REPLACE FUNCTION app.current_workspace_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
AS $$
  SELECT current_setting('app.workspace_id', true)::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
AS $$
  SELECT current_setting('app.user_id', true)::uuid
$$;

-- Revoke EXECUTE from PUBLIC so only our roles can call these.
REVOKE EXECUTE ON FUNCTION app.current_workspace_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.current_user_id()      FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION app.current_workspace_id() TO sp_app, sp_analytics;
GRANT  EXECUTE ON FUNCTION app.current_user_id()      TO sp_app, sp_analytics;


-- =============================================================================
-- SECTION 3: POLICY DESIGN NOTES
-- =============================================================================
--
-- USING vs WITH CHECK
-- -------------------
-- USING(predicate) is evaluated for SELECT, UPDATE (to decide which rows are
-- candidates), and DELETE (to decide which rows may be deleted). It is the
-- "visibility" filter.
--
-- WITH CHECK(predicate) is evaluated for INSERT and UPDATE (to validate the
-- new row state). It is the "write correctness" guard.
--
-- Keeping them separate on INSERT means we can prevent a tenant from inserting
-- a row that claims to belong to a different workspace — the WITH CHECK
-- constraint ensures the workspace_id in the new row matches the session context,
-- regardless of what value the application code supplied.
--
-- FORCE ROW LEVEL SECURITY
-- -------------------------
-- By default, PostgreSQL does NOT apply RLS policies to the table owner (the
-- role that created the table). FORCE ROW LEVEL SECURITY overrides this, so
-- even if sp_app is the table owner, RLS still applies. Without FORCE RLS, a
-- table owner connecting as sp_app would bypass all policies entirely and see
-- every row in every table — a complete tenant-isolation failure.
--
-- SEPARATE POLICIES PER COMMAND
-- ------------------------------
-- We create separate policies for SELECT, INSERT, UPDATE, and DELETE rather
-- than one FOR ALL policy. This allows us to tighten individual operations
-- independently. For example, we can allow SELECT without granting DELETE.
-- It also makes the intent explicit and auditable.
--
-- NULL CONTEXT = DENY
-- -------------------
-- Every predicate below is written so that app.current_workspace_id() returning
-- NULL causes the predicate to evaluate to FALSE (not TRUE, not NULL). In SQL,
-- NULL = anything is NULL, which PostgreSQL treats as FALSE in USING/WITH CHECK.
-- So predicates like:
--   workspace_id = app.current_workspace_id()
-- are naturally NULL-safe: if current_workspace_id() returns NULL, the equality
-- is NULL, which denies the row. No special IS NOT NULL check is required for
-- the simple workspace_id predicates. EXISTS subqueries evaluate to FALSE (not
-- NULL) when the subquery returns no rows, so they are also safe.


-- =============================================================================
-- SECTION 4: REVOKE PUBLIC DEFAULTS
-- =============================================================================
--
-- PostgreSQL grants CONNECT to PUBLIC on every new database and USAGE on the
-- public schema. We revoke these first and grant only what is needed, so a
-- newly created role has no default access.
--
-- NOTE: These REVOKE statements are on schema/database level. The REVOKE ON TABLE
-- statements per-table follow in each table's section to be explicit.

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT  USAGE ON SCHEMA public TO sp_app, sp_service, sp_analytics;

-- The app schema contains our helper functions.
-- Create it if it does not exist (idempotent).
CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO sp_app, sp_service, sp_analytics;


-- =============================================================================
-- SECTION 5: IDENTITY TABLES
-- (identity.ts: users, workspaces, workspace_members, invitations)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: users
-- ---------------------------------------------------------------------------
-- users has no workspace_id. A user may only read their own row, matched on
-- id against the session user context.
-- There is no INSERT policy for sp_app: user rows are created by the auth
-- provider callback code running as sp_service (which bypasses RLS). The
-- application role can UPDATE a user's own profile fields.

REVOKE ALL ON TABLE users FROM PUBLIC;
GRANT SELECT, UPDATE              ON TABLE users TO sp_app;
GRANT SELECT, INSERT, UPDATE      ON TABLE users TO sp_service;
GRANT SELECT                      ON TABLE users TO sp_analytics;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- A user may only read their own row.
CREATE POLICY users_select_self
  ON users
  FOR SELECT
  TO sp_app, sp_analytics
  USING (id = app.current_user_id());

-- A user may only update their own row.
CREATE POLICY users_update_self
  ON users
  FOR UPDATE
  TO sp_app
  USING (id = app.current_user_id())
  WITH CHECK (id = app.current_user_id());

-- sp_service bypasses RLS; no policy needed for it.


-- ---------------------------------------------------------------------------
-- TABLE: workspaces
-- ---------------------------------------------------------------------------
-- AGENCY MODE RECURSION RISK: The policy that grants access to client workspaces
-- via parent_workspace_id joins back to workspace_members. workspace_members
-- itself is RLS-protected with a predicate on workspaces (for the agency check
-- below). This would create circular RLS evaluation if workspace_members policy
-- queried workspaces. We deliberately avoid that: workspace_members SELECT policy
-- is written against workspace_id directly (a value already in the row), not via
-- a subquery to workspaces. Workspaces SELECT policy joins to workspace_members
-- directly. PostgreSQL evaluates RLS one table at a time and does not recursively
-- apply RLS on tables accessed inside a policy predicate (the subquery runs as
-- the function's security context, which is SECURITY DEFINER). However, as an
-- additional safety measure, we do not call app.current_workspace_id() inside
-- the workspace_members subquery used in the workspaces policy — we use
-- app.current_user_id() only, which cannot recurse.

REVOKE ALL ON TABLE workspaces FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE          ON TABLE workspaces TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE workspaces TO sp_service;
GRANT SELECT                          ON TABLE workspaces TO sp_analytics;

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;

-- A workspace is visible when:
--   (a) the current user has a direct membership, OR
--   (b) the workspace is a client workspace (kind = 'client') whose
--       parent_workspace_id the current user is a member of (agency mode).
-- Note: app.current_user_id() NULL causes both EXISTS subqueries to return
-- FALSE (no rows match NULL user_id), so no workspace is visible.
CREATE POLICY workspaces_select_tenant
  ON workspaces
  FOR SELECT
  TO sp_app, sp_analytics
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = app.current_user_id()
    )
    OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.parent_workspace_id
        AND wm.user_id = app.current_user_id()
    )
  );

-- Only sp_service creates workspace rows; sp_app cannot INSERT.
-- (Workspace creation goes through the onboarding worker that runs as sp_service.)

-- Updates: a workspace member with sufficient role may update via sp_app.
-- The application layer enforces the role check; RLS only enforces membership.
CREATE POLICY workspaces_update_tenant
  ON workspaces
  FOR UPDATE
  TO sp_app
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = app.current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = app.current_user_id()
    )
  );


-- ---------------------------------------------------------------------------
-- TABLE: workspace_members
-- ---------------------------------------------------------------------------
-- workspace_members is the membership join table. A user may see membership
-- rows for workspaces they belong to (including their own row). Inserts and
-- deletes are managed by the application layer after role verification; RLS
-- gates them to the workspace the session is operating in.
--
-- NOTE: The SELECT predicate is intentionally simple (workspace_id = session
-- workspace) rather than joining back to workspaces. This avoids the circular
-- RLS risk described in the workspaces section above.

REVOKE ALL ON TABLE workspace_members FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE workspace_members TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE workspace_members TO sp_service;
GRANT SELECT                          ON TABLE workspace_members TO sp_analytics;

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_members_select_tenant
  ON workspace_members
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY workspace_members_insert_tenant
  ON workspace_members
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY workspace_members_update_tenant
  ON workspace_members
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY workspace_members_delete_tenant
  ON workspace_members
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: invitations
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE invitations FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE invitations TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE invitations TO sp_service;
GRANT SELECT                          ON TABLE invitations TO sp_analytics;

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY invitations_select_tenant
  ON invitations
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY invitations_insert_tenant
  ON invitations
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY invitations_update_tenant
  ON invitations
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY invitations_delete_tenant
  ON invitations
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- =============================================================================
-- SECTION 6: FORMS TABLES
-- (forms.ts: forms, form_domains, form_endpoints, form_schema_versions, form_fields)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: forms
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE forms FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE forms TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE forms TO sp_service;
GRANT SELECT                          ON TABLE forms TO sp_analytics;

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms FORCE ROW LEVEL SECURITY;

CREATE POLICY forms_select_tenant
  ON forms
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY forms_insert_tenant
  ON forms
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY forms_update_tenant
  ON forms
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY forms_delete_tenant
  ON forms
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: form_domains
-- (no direct workspace_id — reached via form_id -> forms.workspace_id)
--
-- INDEX NOTE: form_domains.form_id already has an index (form_domains_form_idx)
-- defined in the schema. The EXISTS subquery uses this index for the join.
-- forms.workspace_id is covered by forms_workspace_idx. Performance is adequate.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE form_domains FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE form_domains TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE form_domains TO sp_service;
GRANT SELECT                          ON TABLE form_domains TO sp_analytics;

ALTER TABLE form_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_domains FORCE ROW LEVEL SECURITY;

CREATE POLICY form_domains_select_tenant
  ON form_domains
  FOR SELECT
  TO sp_app, sp_analytics
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_domains.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY form_domains_insert_tenant
  ON form_domains
  FOR INSERT
  TO sp_app
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_domains.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY form_domains_update_tenant
  ON form_domains
  FOR UPDATE
  TO sp_app
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_domains.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_domains.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY form_domains_delete_tenant
  ON form_domains
  FOR DELETE
  TO sp_app
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_domains.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );


-- ---------------------------------------------------------------------------
-- TABLE: form_endpoints
-- (no direct workspace_id — reached via form_id -> forms.workspace_id)
--
-- INDEX NOTE: form_endpoints.form_id is indexed (form_endpoints_form_idx).
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE form_endpoints FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE form_endpoints TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE form_endpoints TO sp_service;
GRANT SELECT                          ON TABLE form_endpoints TO sp_analytics;

ALTER TABLE form_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_endpoints FORCE ROW LEVEL SECURITY;

CREATE POLICY form_endpoints_select_tenant
  ON form_endpoints
  FOR SELECT
  TO sp_app, sp_analytics
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_endpoints.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY form_endpoints_insert_tenant
  ON form_endpoints
  FOR INSERT
  TO sp_app
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_endpoints.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY form_endpoints_update_tenant
  ON form_endpoints
  FOR UPDATE
  TO sp_app
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_endpoints.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_endpoints.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY form_endpoints_delete_tenant
  ON form_endpoints
  FOR DELETE
  TO sp_app
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_endpoints.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );


-- ---------------------------------------------------------------------------
-- TABLE: form_schema_versions
-- (no direct workspace_id — reached via form_id -> forms.workspace_id)
--
-- INDEX NOTE: form_schema_versions.form_id is indexed (form_schema_versions_form_idx).
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE form_schema_versions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE          ON TABLE form_schema_versions TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE form_schema_versions TO sp_service;
GRANT SELECT                          ON TABLE form_schema_versions TO sp_analytics;

ALTER TABLE form_schema_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_schema_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY form_schema_versions_select_tenant
  ON form_schema_versions
  FOR SELECT
  TO sp_app, sp_analytics
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_schema_versions.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY form_schema_versions_insert_tenant
  ON form_schema_versions
  FOR INSERT
  TO sp_app
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_schema_versions.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

-- Schema versions are immutable by design but we allow the app to update
-- metadata fields (e.g. source label) while the service role can update freely.
CREATE POLICY form_schema_versions_update_tenant
  ON form_schema_versions
  FOR UPDATE
  TO sp_app
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_schema_versions.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_schema_versions.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );


-- ---------------------------------------------------------------------------
-- TABLE: form_fields
-- (no direct workspace_id — reached via form_id -> forms.workspace_id)
--
-- INDEX NOTE: form_fields.form_id is indexed (form_fields_form_position_idx).
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE form_fields FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE form_fields TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE form_fields TO sp_service;
GRANT SELECT                          ON TABLE form_fields TO sp_analytics;

ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields FORCE ROW LEVEL SECURITY;

CREATE POLICY form_fields_select_tenant
  ON form_fields
  FOR SELECT
  TO sp_app, sp_analytics
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY form_fields_insert_tenant
  ON form_fields
  FOR INSERT
  TO sp_app
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY form_fields_update_tenant
  ON form_fields
  FOR UPDATE
  TO sp_app
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY form_fields_delete_tenant
  ON form_fields
  FOR DELETE
  TO sp_app
  USING (
    EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
        AND f.workspace_id = app.current_workspace_id()
    )
  );


-- =============================================================================
-- SECTION 7: SUBMISSION TABLES
-- (submissions.ts: submissions, submission_events, submission_files,
--  submission_tags, submission_notes, spam_decisions, spam_rules)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: submissions
-- (has direct workspace_id column — denormalised by design for fast RLS)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE submissions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE submissions TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE submissions TO sp_service;
GRANT SELECT                          ON TABLE submissions TO sp_analytics;

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions FORCE ROW LEVEL SECURITY;

CREATE POLICY submissions_select_tenant
  ON submissions
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY submissions_insert_tenant
  ON submissions
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY submissions_update_tenant
  ON submissions
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY submissions_delete_tenant
  ON submissions
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: submission_events
-- (no direct workspace_id — reached via submission_id -> submissions.workspace_id)
--
-- INDEX NOTE: submission_events.submission_id is indexed
-- (submission_events_submission_idx). submissions.workspace_id is part of the
-- primary table's RLS predicate and is indexed (submissions_workspace_created_idx).
-- The two-hop join (submission_events -> submissions -> workspace_id) is
-- acceptable here because:
--   (a) submission_id is a FK with an index, so the inner join is an index scan.
--   (b) Submission event queries are always scoped to a known submission_id in
--       practice, so the EXISTS check is on a single row.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE submission_events FROM PUBLIC;
GRANT SELECT, INSERT              ON TABLE submission_events TO sp_app;
GRANT SELECT, INSERT, UPDATE      ON TABLE submission_events TO sp_service;
GRANT SELECT                      ON TABLE submission_events TO sp_analytics;

ALTER TABLE submission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_events FORCE ROW LEVEL SECURITY;

-- submission_events is append-only for the application layer; no UPDATE or DELETE
-- policy for sp_app. Absence of a policy = denial.
CREATE POLICY submission_events_select_tenant
  ON submission_events
  FOR SELECT
  TO sp_app, sp_analytics
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_events.submission_id
        AND s.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY submission_events_insert_tenant
  ON submission_events
  FOR INSERT
  TO sp_app
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_events.submission_id
        AND s.workspace_id = app.current_workspace_id()
    )
  );


-- ---------------------------------------------------------------------------
-- TABLE: submission_files
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE submission_files FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE submission_files TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE submission_files TO sp_service;
GRANT SELECT                          ON TABLE submission_files TO sp_analytics;

ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files FORCE ROW LEVEL SECURITY;

CREATE POLICY submission_files_select_tenant
  ON submission_files
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY submission_files_insert_tenant
  ON submission_files
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY submission_files_update_tenant
  ON submission_files
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY submission_files_delete_tenant
  ON submission_files
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: submission_tags
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE submission_tags FROM PUBLIC;
GRANT SELECT, INSERT, DELETE          ON TABLE submission_tags TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE submission_tags TO sp_service;
GRANT SELECT                          ON TABLE submission_tags TO sp_analytics;

ALTER TABLE submission_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_tags FORCE ROW LEVEL SECURITY;

CREATE POLICY submission_tags_select_tenant
  ON submission_tags
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY submission_tags_insert_tenant
  ON submission_tags
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

-- Tags are not updated; they are deleted and recreated. No UPDATE policy for sp_app.

CREATE POLICY submission_tags_delete_tenant
  ON submission_tags
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: submission_notes
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE submission_notes FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE submission_notes TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE submission_notes TO sp_service;
GRANT SELECT                          ON TABLE submission_notes TO sp_analytics;

ALTER TABLE submission_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY submission_notes_select_tenant
  ON submission_notes
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY submission_notes_insert_tenant
  ON submission_notes
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY submission_notes_update_tenant
  ON submission_notes
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY submission_notes_delete_tenant
  ON submission_notes
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: spam_decisions
-- (no direct workspace_id — reached via submission_id -> submissions.workspace_id)
--
-- INDEX NOTE: spam_decisions has a unique index on submission_id
-- (spam_decisions_submission_key). The EXISTS join is an index-only scan.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE spam_decisions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE          ON TABLE spam_decisions TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE spam_decisions TO sp_service;
GRANT SELECT                          ON TABLE spam_decisions TO sp_analytics;

ALTER TABLE spam_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spam_decisions FORCE ROW LEVEL SECURITY;

CREATE POLICY spam_decisions_select_tenant
  ON spam_decisions
  FOR SELECT
  TO sp_app, sp_analytics
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = spam_decisions.submission_id
        AND s.workspace_id = app.current_workspace_id()
    )
  );

CREATE POLICY spam_decisions_insert_tenant
  ON spam_decisions
  FOR INSERT
  TO sp_app
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = spam_decisions.submission_id
        AND s.workspace_id = app.current_workspace_id()
    )
  );

-- Updates are for override_verdict when a human overrides the automated decision.
CREATE POLICY spam_decisions_update_tenant
  ON spam_decisions
  FOR UPDATE
  TO sp_app
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = spam_decisions.submission_id
        AND s.workspace_id = app.current_workspace_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = spam_decisions.submission_id
        AND s.workspace_id = app.current_workspace_id()
    )
  );


-- ---------------------------------------------------------------------------
-- TABLE: spam_rules
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE spam_rules FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE spam_rules TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE spam_rules TO sp_service;
GRANT SELECT                          ON TABLE spam_rules TO sp_analytics;

ALTER TABLE spam_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE spam_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY spam_rules_select_tenant
  ON spam_rules
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY spam_rules_insert_tenant
  ON spam_rules
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY spam_rules_update_tenant
  ON spam_rules
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY spam_rules_delete_tenant
  ON spam_rules
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- =============================================================================
-- SECTION 8: DELIVERY TABLES
-- (delivery.ts: email_destinations, email_deliveries, autoresponders,
--  webhook_endpoints, webhook_deliveries, integrations)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: email_destinations
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE email_destinations FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE email_destinations TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE email_destinations TO sp_service;
GRANT SELECT                          ON TABLE email_destinations TO sp_analytics;

ALTER TABLE email_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_destinations FORCE ROW LEVEL SECURITY;

CREATE POLICY email_destinations_select_tenant
  ON email_destinations
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY email_destinations_insert_tenant
  ON email_destinations
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY email_destinations_update_tenant
  ON email_destinations
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY email_destinations_delete_tenant
  ON email_destinations
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: email_deliveries
-- (has direct workspace_id column)
-- Append-only for sp_app: INSERT and SELECT only. No UPDATE or DELETE policy
-- for sp_app — the worker (sp_service, BYPASSRLS) manages status transitions.
-- Absence of UPDATE/DELETE policy for sp_app means denial.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE email_deliveries FROM PUBLIC;
GRANT SELECT, INSERT                  ON TABLE email_deliveries TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE email_deliveries TO sp_service;
GRANT SELECT                          ON TABLE email_deliveries TO sp_analytics;

ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_deliveries FORCE ROW LEVEL SECURITY;

CREATE POLICY email_deliveries_select_tenant
  ON email_deliveries
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY email_deliveries_insert_tenant
  ON email_deliveries
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: autoresponders
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE autoresponders FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE autoresponders TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE autoresponders TO sp_service;
GRANT SELECT                          ON TABLE autoresponders TO sp_analytics;

ALTER TABLE autoresponders ENABLE ROW LEVEL SECURITY;
ALTER TABLE autoresponders FORCE ROW LEVEL SECURITY;

CREATE POLICY autoresponders_select_tenant
  ON autoresponders
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY autoresponders_insert_tenant
  ON autoresponders
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY autoresponders_update_tenant
  ON autoresponders
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY autoresponders_delete_tenant
  ON autoresponders
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: webhook_endpoints
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE webhook_endpoints FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE webhook_endpoints TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE webhook_endpoints TO sp_service;
GRANT SELECT                          ON TABLE webhook_endpoints TO sp_analytics;

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints FORCE ROW LEVEL SECURITY;

CREATE POLICY webhook_endpoints_select_tenant
  ON webhook_endpoints
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY webhook_endpoints_insert_tenant
  ON webhook_endpoints
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY webhook_endpoints_update_tenant
  ON webhook_endpoints
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY webhook_endpoints_delete_tenant
  ON webhook_endpoints
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: webhook_deliveries
-- (has direct workspace_id column)
-- Append-only for sp_app: delivery status transitions are managed by sp_service.
-- sp_app may read delivery history for debugging via the UI.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE webhook_deliveries FROM PUBLIC;
GRANT SELECT                          ON TABLE webhook_deliveries TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE webhook_deliveries TO sp_service;
GRANT SELECT                          ON TABLE webhook_deliveries TO sp_analytics;

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY;

CREATE POLICY webhook_deliveries_select_tenant
  ON webhook_deliveries
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

-- sp_app has no INSERT/UPDATE/DELETE policy on webhook_deliveries.
-- The delivery worker (sp_service, BYPASSRLS) owns the lifecycle of these rows.
-- Absence of policy = denial for sp_app.


-- ---------------------------------------------------------------------------
-- TABLE: integrations
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE integrations FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE integrations TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE integrations TO sp_service;
GRANT SELECT                          ON TABLE integrations TO sp_analytics;

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;

CREATE POLICY integrations_select_tenant
  ON integrations
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY integrations_insert_tenant
  ON integrations
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY integrations_update_tenant
  ON integrations
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY integrations_delete_tenant
  ON integrations
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- =============================================================================
-- SECTION 9: HEALTH TABLES
-- (health.ts: health_monitors, health_runs, incidents, schema_drift_events)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: health_monitors
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE health_monitors FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE health_monitors TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE health_monitors TO sp_service;
GRANT SELECT                          ON TABLE health_monitors TO sp_analytics;

ALTER TABLE health_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_monitors FORCE ROW LEVEL SECURITY;

CREATE POLICY health_monitors_select_tenant
  ON health_monitors
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY health_monitors_insert_tenant
  ON health_monitors
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY health_monitors_update_tenant
  ON health_monitors
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY health_monitors_delete_tenant
  ON health_monitors
  FOR DELETE
  TO sp_app
  USING (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: health_runs
-- (has direct workspace_id column)
-- Append-only for sp_app — the worker creates and updates run records.
-- sp_app reads them for the Pulse dashboard; it cannot create or modify runs.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE health_runs FROM PUBLIC;
GRANT SELECT                          ON TABLE health_runs TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE health_runs TO sp_service;
GRANT SELECT                          ON TABLE health_runs TO sp_analytics;

ALTER TABLE health_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY health_runs_select_tenant
  ON health_runs
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

-- No INSERT/UPDATE/DELETE policy for sp_app. Absence = denial.
-- sp_service (BYPASSRLS) manages run lifecycle.


-- ---------------------------------------------------------------------------
-- TABLE: incidents
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE incidents FROM PUBLIC;
GRANT SELECT, UPDATE                  ON TABLE incidents TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE incidents TO sp_service;
GRANT SELECT                          ON TABLE incidents TO sp_analytics;

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents FORCE ROW LEVEL SECURITY;

CREATE POLICY incidents_select_tenant
  ON incidents
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

-- sp_app may update incidents (acknowledge, resolve) but cannot create or delete.
CREATE POLICY incidents_update_tenant
  ON incidents
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: schema_drift_events
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE schema_drift_events FROM PUBLIC;
GRANT SELECT, UPDATE                  ON TABLE schema_drift_events TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE schema_drift_events TO sp_service;
GRANT SELECT                          ON TABLE schema_drift_events TO sp_analytics;

ALTER TABLE schema_drift_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_drift_events FORCE ROW LEVEL SECURITY;

CREATE POLICY schema_drift_events_select_tenant
  ON schema_drift_events
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

-- sp_app may update drift events (resolve, set ai_repair_prompt accepted)
-- but cannot create them; the worker detects drift.
CREATE POLICY schema_drift_events_update_tenant
  ON schema_drift_events
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());


-- =============================================================================
-- SECTION 10: PLATFORM TABLES
-- (platform.ts: api_keys, installation_tokens, usage_events, subscriptions,
--  audit_logs, security_events, feature_flags, background_jobs)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: api_keys
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE api_keys FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE          ON TABLE api_keys TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE api_keys TO sp_service;
GRANT SELECT                          ON TABLE api_keys TO sp_analytics;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

CREATE POLICY api_keys_select_tenant
  ON api_keys
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY api_keys_insert_tenant
  ON api_keys
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

-- UPDATE is used to set revoked_at, last_used_at etc.
CREATE POLICY api_keys_update_tenant
  ON api_keys
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());

-- Hard deletes of API key records are sp_service only (e.g. key rotation cleanup).


-- ---------------------------------------------------------------------------
-- TABLE: installation_tokens
-- (has direct workspace_id column)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE installation_tokens FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE          ON TABLE installation_tokens TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE installation_tokens TO sp_service;
GRANT SELECT                          ON TABLE installation_tokens TO sp_analytics;

ALTER TABLE installation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY installation_tokens_select_tenant
  ON installation_tokens
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY installation_tokens_insert_tenant
  ON installation_tokens
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

CREATE POLICY installation_tokens_update_tenant
  ON installation_tokens
  FOR UPDATE
  TO sp_app
  USING (workspace_id = app.current_workspace_id())
  WITH CHECK (workspace_id = app.current_workspace_id());


-- ---------------------------------------------------------------------------
-- TABLE: usage_events
-- (has direct workspace_id column)
-- Append-only for sp_app. The metering ledger must not be editable by
-- application code — the worker writes usage rows, the app only reads them.
-- Absence of UPDATE/DELETE policy for sp_app = denial.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE usage_events FROM PUBLIC;
GRANT SELECT                          ON TABLE usage_events TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE usage_events TO sp_service;
GRANT SELECT                          ON TABLE usage_events TO sp_analytics;

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events FORCE ROW LEVEL SECURITY;

CREATE POLICY usage_events_select_tenant
  ON usage_events
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

-- sp_app has no INSERT/UPDATE/DELETE. sp_service owns usage event creation.


-- ---------------------------------------------------------------------------
-- TABLE: subscriptions
-- (has direct workspace_id column)
-- sp_app reads subscription status to gate features; it cannot modify billing
-- records. Stripe webhook handling runs as sp_service.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE subscriptions FROM PUBLIC;
GRANT SELECT                          ON TABLE subscriptions TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE subscriptions TO sp_service;
GRANT SELECT                          ON TABLE subscriptions TO sp_analytics;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_tenant
  ON subscriptions
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

-- No INSERT/UPDATE/DELETE policy for sp_app. Only sp_service (BYPASSRLS)
-- may write subscription rows, driven by Stripe webhook events.


-- ---------------------------------------------------------------------------
-- TABLE: audit_logs
-- APPEND-ONLY: grant INSERT and SELECT to sp_app; explicitly NO UPDATE or
-- DELETE policy for sp_app or sp_analytics.
-- Comment: absence of an UPDATE or DELETE policy means PostgreSQL denies those
-- commands entirely for the role. This is the enforcement mechanism for
-- append-only semantics at the database layer — it is not sufficient on its own
-- (table owner / superuser can always bypass, and sp_service bypasses RLS) but
-- it ensures that a compromised sp_app connection cannot mutate the audit trail.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE audit_logs FROM PUBLIC;
GRANT SELECT, INSERT                  ON TABLE audit_logs TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE audit_logs TO sp_service;
GRANT SELECT                          ON TABLE audit_logs TO sp_analytics;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select_tenant
  ON audit_logs
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY audit_logs_insert_tenant
  ON audit_logs
  FOR INSERT
  TO sp_app
  WITH CHECK (workspace_id = app.current_workspace_id());

-- There is deliberately NO UPDATE policy and NO DELETE policy for sp_app.
-- sp_service (BYPASSRLS) handles cold-storage archival and hard deletes after
-- the retention window, outside of user-visible code paths.


-- ---------------------------------------------------------------------------
-- TABLE: security_events
-- APPEND-ONLY: same pattern as audit_logs.
-- security_events.workspace_id is nullable (events before workspace context,
-- e.g. failed logins, have NULL workspace_id). We apply RLS only on workspace-
-- scoped rows; events with NULL workspace_id are not visible to sp_app because
-- NULL = app.current_workspace_id() evaluates to NULL (false). This is correct:
-- platform-level security events without a workspace context are surfaced only
-- to platform staff via sp_service or direct superuser access.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE security_events FROM PUBLIC;
GRANT SELECT, INSERT                  ON TABLE security_events TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE security_events TO sp_service;
GRANT SELECT                          ON TABLE security_events TO sp_analytics;

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events FORCE ROW LEVEL SECURITY;

CREATE POLICY security_events_select_tenant
  ON security_events
  FOR SELECT
  TO sp_app, sp_analytics
  USING (workspace_id = app.current_workspace_id());

CREATE POLICY security_events_insert_tenant
  ON security_events
  FOR INSERT
  TO sp_app
  WITH CHECK (
    -- Allow inserting workspace-scoped events only; NULL workspace_id events
    -- must be written by sp_service (worker / system).
    workspace_id = app.current_workspace_id()
  );

-- There is deliberately NO UPDATE policy and NO DELETE policy for sp_app.


-- ---------------------------------------------------------------------------
-- TABLE: feature_flags
-- Platform-level table — NOT workspace-scoped.
-- Readable by all authenticated roles. Writable only by sp_service.
-- RLS is enabled so we can use policies explicitly, but there is no workspace
-- predicate. We use a simple allow-all for SELECT and deny-all for writes
-- (no INSERT/UPDATE/DELETE policy for sp_app).
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE feature_flags FROM PUBLIC;
GRANT SELECT                          ON TABLE feature_flags TO sp_app;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE feature_flags TO sp_service;
GRANT SELECT                          ON TABLE feature_flags TO sp_analytics;

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags FORCE ROW LEVEL SECURITY;

-- Any authenticated connection (sp_app, sp_analytics) may read all feature flags.
-- Flag evaluation happens in the application layer, which also filters by
-- enabled_workspace_ids and rollout_percent.
CREATE POLICY feature_flags_select_all
  ON feature_flags
  FOR SELECT
  TO sp_app, sp_analytics
  USING (true);

-- There is NO INSERT, UPDATE, or DELETE policy for sp_app or sp_analytics.
-- Only sp_service (BYPASSRLS) may mutate feature flags — this enforces that
-- flag management is always a platform-operator action, never a user action.


-- ---------------------------------------------------------------------------
-- TABLE: background_jobs
-- Service role only. sp_app has no access — this table is internal
-- infrastructure for the worker system. Exposing job payloads (which may
-- contain cross-tenant data) to sp_app would be a data leakage risk.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE background_jobs FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE  ON TABLE background_jobs TO sp_service;
-- sp_app and sp_analytics: no GRANT, no policy. Denial is at the privilege
-- level (no GRANT), which is stronger than RLS-level denial.
-- RLS is still enabled for defence in depth in case privileges are widened.

ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_jobs FORCE ROW LEVEL SECURITY;

-- No policies for sp_app or sp_analytics — both the privilege layer (no GRANT)
-- and the RLS layer (no policy) deny access.


-- =============================================================================
-- SECTION 11: SEQUENCE GRANTS
-- =============================================================================
--
-- Tables with defaultRandom() (uuid_generate_v4) do not need sequence grants.
-- All primary keys in this schema use gen_random_uuid() / defaultRandom(),
-- so no explicit sequence grants are required.


-- =============================================================================
-- SECTION 12: VERIFICATION CHECKLIST
-- =============================================================================
--
-- The following negative and positive tests MUST be run as part of the
-- integration test suite before each production deployment. These tests should
-- connect as sp_app (with RLS enforced), not as a superuser.
--
-- CROSS-TENANT ISOLATION (negative tests — all must return 0 rows or raise)
-- --------------------------------------------------------------------------
-- T01. SET LOCAL app.workspace_id = '<workspace_A_id>';
--      SELECT count(*) FROM submissions WHERE workspace_id = '<workspace_B_id>';
--      --> must return 0.
--
-- T02. SET LOCAL app.workspace_id = '<workspace_A_id>';
--      INSERT INTO forms (workspace_id, ...) VALUES ('<workspace_B_id>', ...);
--      --> must raise ERROR (violates WITH CHECK).
--
-- T03. SET LOCAL app.workspace_id = '<workspace_A_id>';
--      UPDATE submissions SET status = 'spam' WHERE workspace_id = '<workspace_B_id>';
--      --> must affect 0 rows (USING predicate filters out all B rows).
--
-- T04. SET LOCAL app.workspace_id = '<workspace_A_id>';
--      DELETE FROM workspace_members WHERE workspace_id = '<workspace_B_id>';
--      --> must affect 0 rows.
--
-- T05. SET LOCAL app.workspace_id = '<workspace_A_id>';
--      -- form_domains of workspace_B (reached via join):
--      SELECT count(*) FROM form_domains fd
--        JOIN forms f ON f.id = fd.form_id
--        WHERE f.workspace_id = '<workspace_B_id>';
--      --> must return 0 (RLS on form_domains prevents access).
--
-- NULL CONTEXT (negative tests — must return 0 rows or raise)
-- -----------------------------------------------------------
-- T06. -- Do NOT set app.workspace_id.
--      SELECT count(*) FROM submissions;
--      --> must return 0 (NULL context = deny).
--
-- T07. -- Do NOT set app.workspace_id.
--      INSERT INTO forms (workspace_id, ...) VALUES ('<any_workspace_id>', ...);
--      --> must raise ERROR (WITH CHECK: NULL != any uuid = false).
--
-- T08. -- Do NOT set app.user_id.
--      SELECT count(*) FROM users;
--      --> must return 0 (NULL user context = deny).
--
-- POSITIVE TESTS (correct tenant must see their data)
-- ---------------------------------------------------
-- T09. SET LOCAL app.workspace_id = '<workspace_A_id>';
--      SET LOCAL app.user_id = '<user_in_A_id>';
--      SELECT count(*) FROM submissions WHERE workspace_id = '<workspace_A_id>';
--      --> must return the actual count for workspace A.
--
-- T10. SET LOCAL app.workspace_id = '<workspace_A_id>';
--      SET LOCAL app.user_id = '<user_in_A_id>';
--      SELECT count(*) FROM users WHERE id = '<user_in_A_id>';
--      --> must return 1.
--
-- AUDIT LOG APPEND-ONLY (negative tests)
-- ---------------------------------------
-- T11. SET LOCAL app.workspace_id = '<workspace_A_id>';
--      UPDATE audit_logs SET action = 'tampered' WHERE workspace_id = '<workspace_A_id>';
--      --> must affect 0 rows (no UPDATE policy for sp_app).
--
-- T12. SET LOCAL app.workspace_id = '<workspace_A_id>';
--      DELETE FROM audit_logs WHERE workspace_id = '<workspace_A_id>';
--      --> must affect 0 rows (no DELETE policy for sp_app).
--
-- AGENCY MODE (positive test)
-- ---------------------------
-- T13. SET LOCAL app.user_id = '<agency_user_id>';
--      -- agency_user is a member of workspace_agency, which is the parent of workspace_client.
--      SET LOCAL app.workspace_id = '<workspace_client_id>';
--      SELECT count(*) FROM workspaces WHERE id = '<workspace_client_id>';
--      --> must return 1 (agency member can see client workspace).
--
-- FEATURE FLAGS (positive test — all authenticated sessions)
-- ----------------------------------------------------------
-- T14. -- Set any valid app.workspace_id (or even NULL).
--      SELECT count(*) FROM feature_flags;
--      --> must return the total number of flags (all flags are visible).
--
-- BACKGROUND JOBS (negative test — sp_app has no access)
-- -------------------------------------------------------
-- T15. SET LOCAL app.workspace_id = '<workspace_A_id>';
--      SELECT count(*) FROM background_jobs;
--      --> must raise ERROR: permission denied (no GRANT to sp_app).
--
-- =============================================================================
