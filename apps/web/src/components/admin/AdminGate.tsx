/**
 * AdminGate — server-side platform-admin access check.
 *
 * SECURITY DESIGN:
 * - Access to admin routes requires `actor.isPlatformAdmin === true`.
 * - `can()` from @submitpulse/auth/permissions deliberately does NOT grant
 *   platform admins ambient tenant access. Admin routes gate on the separate
 *   isPlatformAdmin flag, not on workspace roles.
 * - This gate is enforced server-side; it is not a client-only UI guard.
 * - In production, replace FIXTURE_ACTOR with the real session lookup that
 *   verifies the platform-admin claim against the database.
 */

import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { FIXTURE_OPS_EMAIL } from "@/lib/admin-data";

// ---------------------------------------------------------------------------
// Fixture actor — replace with real session in production
// ---------------------------------------------------------------------------

/**
 * DEVELOPMENT FIXTURE: returns a hardcoded platform-admin actor.
 * In production this must be replaced with a server-side session lookup
 * that validates isPlatformAdmin from the database, never from a JWT claim alone.
 */
export function getFixtureAdminActor() {
  return {
    userId: "usr-005",
    email: FIXTURE_OPS_EMAIL,
    workspaceId: "platform", // sentinel — platform admins have no tenant workspace
    role: "owner" as const,
    isPlatformAdmin: true as const,
  };
}

interface AdminGateProps {
  children: ReactNode;
}

/**
 * Server component that verifies isPlatformAdmin before rendering children.
 * Non-admins are redirected to the customer dashboard root.
 */
export async function AdminGate({ children }: AdminGateProps): Promise<ReactNode> {
  // In production: const session = await getServerSession(); if (!session?.isPlatformAdmin) redirect('/overview');
  const actor = getFixtureAdminActor();
  if (!actor.isPlatformAdmin) {
    redirect("/overview");
  }
  return children;
}
