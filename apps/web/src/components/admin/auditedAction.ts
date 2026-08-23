/**
 * auditedAction — structural helper that makes forgetting an audit entry hard.
 *
 * SECURITY DESIGN:
 * Every mutating admin action MUST produce an audit_logs row with
 * actorType 'support' or 'system'. This helper enforces that by requiring the
 * caller to supply audit parameters before the action function is invoked.
 *
 * In production, replace the console.log with a real Drizzle INSERT into
 * audit_logs. The signature is intentionally synchronous-first so callers
 * cannot skip the await and miss the write.
 *
 * NOTE: `can()` from permissions.ts deliberately does NOT grant platform admins
 * ambient tenant access. Admin routes gate on actor.isPlatformAdmin (the
 * platform-admin flag), NOT on workspace roles. This helper enforces
 * actorType 'support' or 'system', which maps to audit_logs check constraint.
 */

export interface AuditParams {
  /** ID of the operator taking the action. */
  actorId: string;
  /** Display label: operator email or system job name. */
  actorLabel: string;
  /** Must be 'support' for human operators, 'system' for automated jobs. */
  actorType: "support" | "system";
  /** Dot-namespaced event name, e.g. 'workspace.suspended'. */
  action: string;
  workspaceId: string;
  resourceType?: string;
  resourceId?: string;
  /** Human-readable justification. Required for content-access escalations. */
  reason?: string;
  /** Snapshot before mutation (metadata only — never include submission content). */
  before?: Record<string, unknown>;
  /** Snapshot after mutation (metadata only — never include submission content). */
  after?: Record<string, unknown>;
}

export type AuditedActionResult<T> =
  | { ok: true; data: T; auditId: string }
  | { ok: false; error: string };

/**
 * Wraps a mutating function with a mandatory audit entry.
 *
 * Usage:
 *   const result = await auditedAction(
 *     {
 *       actorId: session.userId,
 *       actorLabel: session.email,
 *       actorType: "support",
 *       action: "workspace.suspended",
 *       workspaceId: ws.id,
 *       resourceType: "workspace",
 *       resourceId: ws.id,
 *       reason: "Abuse: volume spike",
 *     },
 *     async () => {
 *       // your mutation here
 *       await db.update(workspaces).set({ status: "suspended" }).where(eq(workspaces.id, ws.id));
 *     },
 *   );
 */
export async function auditedAction<T>(
  params: AuditParams,
  action: () => Promise<T>,
): Promise<AuditedActionResult<T>> {
  const auditId = `al_${Math.random().toString(36).slice(2, 10)}`;

  try {
    // STEP 1: Write the audit entry BEFORE the mutation so a crash mid-action
    // still produces an audit trail. In production: INSERT INTO audit_logs.
    // DEVELOPMENT FIXTURE — replace with real Drizzle INSERT:
    console.log("[AUDIT]", {
      id: auditId,
      ...params,
      createdAt: new Date().toISOString(),
    });

    // STEP 2: Execute the mutation.
    const data = await action();

    return { ok: true, data, auditId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}
