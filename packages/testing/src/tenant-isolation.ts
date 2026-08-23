/**
 * TenantIsolationHarness — interface documenting the negative tests that
 * Row Level Security (RLS) must satisfy.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATUS: DOCUMENTED ONLY — NO DATABASE EXISTS YET.
 *
 * This interface describes the contract that a real integration test harness
 * MUST implement once a live test database is available. It exists now so that:
 *   1. The contract is visible in code review before implementation.
 *   2. Any future implementation can be type-checked against this interface.
 *   3. Developers understand what RLS properties the system is supposed to hold.
 *
 * When implementing, the harness will need:
 *   - A Supabase/Postgres test database with RLS policies enabled.
 *   - Two distinct tenant contexts (workspaceA, workspaceB).
 *   - A way to run queries "as" a given workspace (via the auth.uid() function
 *     that RLS policies inspect, or via separate Supabase client instances
 *     with workspace-scoped JWTs).
 *
 * Each method below represents one invariant that MUST hold at the DB layer
 * regardless of application-layer bugs. The application layer (can() checks
 * in permissions.ts) and the DB layer (RLS) are complementary: RLS is the
 * backstop when the application layer is bypassed by a bug.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Context describing one tenant in the isolation harness.
 * Both workspaces must be fully provisioned before any assertion runs.
 */
export interface TenantContext {
  /** Internal UUID of the workspace. */
  readonly workspaceId: string;
  /** Internal UUID of a user who is an owner of this workspace. */
  readonly ownerUserId: string;
  /** Database client or connection authenticated as `ownerUserId`. */
  // db: SupabaseClient | Pool; // type depends on the chosen test driver
}

/**
 * Interface that a real RLS integration test harness must implement.
 *
 * Every method corresponds to one isolation invariant. The method name
 * describes the invariant as a sentence. Implementation should:
 *   1. Create the resource in tenantA's context.
 *   2. Attempt to read/modify/delete it from tenantB's context.
 *   3. Assert that the attempt returns zero rows or throws a permission error.
 *
 * NONE of these methods are implemented here — the interface is the spec.
 */
export interface TenantIsolationHarness {
  /**
   * A workspace member of tenantA cannot read submissions belonging to tenantB.
   *
   * Invariant: SELECT on submissions WHERE workspace_id = tenantB returns 0 rows
   * when the requesting auth context belongs to tenantA.
   */
  submissionInTenantAIsNotReadableByTenantB(): Promise<void>;

  /**
   * A workspace member of tenantA cannot update submissions belonging to tenantB.
   *
   * Invariant: UPDATE on submissions WHERE id = <tenantB submission> returns 0
   * rows affected when the requesting auth context belongs to tenantA.
   */
  submissionInTenantAIsNotUpdatableByTenantB(): Promise<void>;

  /**
   * A workspace member of tenantA cannot delete submissions belonging to tenantB.
   *
   * Invariant: DELETE on submissions WHERE id = <tenantB submission> returns 0
   * rows affected when the requesting auth context belongs to tenantA.
   */
  submissionInTenantAIsNotDeletableByTenantB(): Promise<void>;

  /**
   * A workspace member of tenantA cannot read forms belonging to tenantB.
   *
   * Invariant: SELECT on forms WHERE workspace_id = tenantB returns 0 rows
   * when the requesting auth context belongs to tenantA.
   */
  formInTenantAIsNotReadableByTenantB(): Promise<void>;

  /**
   * A workspace member of tenantA cannot update forms belonging to tenantB.
   */
  formInTenantAIsNotUpdatableByTenantB(): Promise<void>;

  /**
   * A workspace member of tenantA cannot read webhook endpoints belonging to tenantB.
   */
  webhookEndpointInTenantAIsNotReadableByTenantB(): Promise<void>;

  /**
   * A workspace member of tenantA cannot read API keys belonging to tenantB.
   */
  apiKeyInTenantAIsNotReadableByTenantB(): Promise<void>;

  /**
   * A workspace member of tenantA cannot read submission files belonging to tenantB.
   */
  submissionFileInTenantAIsNotReadableByTenantB(): Promise<void>;

  /**
   * A workspace member of tenantA cannot read invitations belonging to tenantB.
   */
  invitationInTenantAIsNotReadableByTenantB(): Promise<void>;

  /**
   * A workspace member of tenantA cannot insert a submission row
   * with workspace_id set to tenantB's workspace ID.
   *
   * Invariant: INSERT into submissions with workspace_id = tenantB raises an
   * RLS violation when the requesting auth context belongs to tenantA.
   */
  tenantAMemberCannotInsertSubmissionForTenantB(): Promise<void>;

  /**
   * A platform admin reading data through the regular (non-escalated) DB
   * connection can only see their own workspace rows, not all tenants.
   *
   * Invariant: The isPlatformAdmin flag in the users table does NOT grant
   * cross-tenant DB access. Support escalation requires a separate mechanism.
   */
  platformAdminFlagDoesNotGrantCrossTenantDbAccess(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Placeholder export so the module has a runtime value. Real harness
// implementations import and implement TenantIsolationHarness.
// ---------------------------------------------------------------------------

/**
 * Marker thrown by placeholder implementations.
 * Throw this in a real harness method stub before the DB is available.
 */
export class TenantIsolationNotImplementedError extends Error {
  constructor(methodName: string) {
    super(
      `TenantIsolationHarness.${methodName} is not yet implemented. ` +
        "A live test database with RLS policies is required.",
    );
    this.name = "TenantIsolationNotImplementedError";
  }
}
