"use client";

import type { Actor, Permission } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import type { ReactNode } from "react";

interface PermissionGateProps {
  actor: Actor;
  permission: Permission;
  /** Rendered when permission is denied. Defaults to nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders `children` only when `can(actor, permission)` returns true.
 * Never compares role names — always delegates to can().
 */
export function PermissionGate({
  actor,
  permission,
  fallback = null,
  children,
}: PermissionGateProps): ReactNode {
  if (!can(actor, permission)) return fallback;
  return children;
}
