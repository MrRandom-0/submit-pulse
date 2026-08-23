/**
 * @submitpulse/auth — barrel export
 *
 * Public surface:
 *  - provider.ts   — AuthProvider interface and result types
 *  - supabase-provider.ts — Supabase driver (INCOMPLETE — NOT PRODUCTION VERIFIED)
 *  - dev-provider.ts — in-memory driver for development and tests
 *  - session.ts    — server-side App Router session helpers
 *  - password-policy.ts — password validation rules
 *  - permissions.ts — Actor, can(), Permission (authorization layer — do not modify)
 */

// Provider interface and shared types
export type {
  AuthProvider,
  AuthResult,
  AuthSession,
  AuthSuccess,
  AuthFailure,
  OAuthRedirect,
  MfaEnrollment,
  RateLimitContext,
  SignInErrorCode,
  SignUpErrorCode,
  OAuthErrorCode,
  MagicLinkErrorCode,
  VerifyEmailErrorCode,
  PasswordResetRequestErrorCode,
  PasswordResetErrorCode,
  MfaErrorCode,
  SessionErrorCode,
  SignOutErrorCode,
} from "./provider";

// Supabase driver (INCOMPLETE)
export { SupabaseProvider, SupabaseConfigError } from "./supabase-provider";

// Dev/test in-memory driver
export { DevProvider } from "./dev-provider";

// Server-side session helpers
export {
  setProvider,
  getSession,
  requireSession,
  getActor,
  requireActor,
} from "./session";

// Password policy
export {
  checkPassword,
  checkPasswordSync,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  NullBreachChecker,
} from "./password-policy";

export type {
  PasswordPolicyResult,
  PasswordViolation,
  BreachChecker,
} from "./password-policy";

// Authorization layer (re-exported for convenience — do not modify permissions.ts)
export {
  can,
  assertCan,
  canManageMemberWithRole,
  canAssignRole,
  permissionsForRole,
  AuthorizationError,
  PERMISSION_MATRIX,
  PERMISSIONS,
  WORKSPACE_ROLES,
} from "./permissions";

export type {
  Actor,
  Permission,
  WorkspaceRole,
} from "./permissions";
