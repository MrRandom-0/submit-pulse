/**
 * Password Policy
 * ===============
 *
 * IMPORTANT: This module defines policy RULES only.
 * Credential STORAGE is entirely delegated to the auth provider
 * (Supabase Auth or the dev-provider). We never hold password hashes
 * in the application layer. A compromise of the application database
 * does not expose password material.
 *
 * INCOMPLETE: The breach-check interface (BreachChecker) is defined but
 * the production implementation is NOT wired — it requires integration with
 * the HaveIBeenPwned k-Anonymity API (packages/security). The default
 * NullBreachChecker always passes (never flags a breach) so the app is
 * functional without it. Wire in a real checker before production.
 */

/* -------------------------------------------------------------------------- */
/* Policy constants                                                            */
/* -------------------------------------------------------------------------- */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128; // bcrypt has a 72-byte practical limit; we normalise above

/**
 * Common patterns that are never acceptable regardless of length.
 * Kept short — the breach list is the primary defence against known-bad passwords.
 */
const TRIVIAL_PATTERNS: readonly RegExp[] = [
  /^(.)\1+$/, // all same character: "aaaaaa"
  /^(012|123|234|345|456|567|678|789|890)+$/i, // simple numeric runs
  /^(qwerty|asdfgh|zxcvbn|abcdef)/i, // keyboard walks
];

/* -------------------------------------------------------------------------- */
/* Breach-check interface                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Pluggable breach checker. Implementations MUST use k-Anonymity:
 * send only the first 5 hex chars of SHA-1(password) and check the response
 * list — never send the full password or its hash to an external service.
 *
 * See: https://haveibeenpwned.com/API/v3#PwnedPasswords
 *
 * INCOMPLETE: Only NullBreachChecker is bundled. Wire a real implementation
 * in packages/security and inject it via the password policy factory.
 */
export interface BreachChecker {
  /**
   * Returns true if the password appears in a known breach corpus.
   * Must never throw — returns false (safe) on any network or parsing error
   * so a breach-API outage does not block logins.
   */
  isBreached(password: string): Promise<boolean>;
}

/** Stub: always reports clean. Replace before production. */
export const NullBreachChecker: BreachChecker = {
  async isBreached(_password: string): Promise<boolean> {
    return false;
  },
};

/* -------------------------------------------------------------------------- */
/* Policy evaluation                                                           */
/* -------------------------------------------------------------------------- */

export interface PasswordViolation {
  readonly code:
    | "too_short"
    | "too_long"
    | "trivial_pattern"
    | "breached";
  readonly message: string;
}

export interface PasswordPolicyResult {
  readonly valid: boolean;
  readonly violations: readonly PasswordViolation[];
  /**
   * Strength score 0–4 (for UI meter).
   * 0 = rejected, 1-2 = weak, 3 = good, 4 = strong.
   * This is advisory only — a score above zero does not mean the policy passed.
   */
  readonly strengthScore: 0 | 1 | 2 | 3 | 4;
}

/** Synchronous portion of the check (no async breach lookup). */
function checkSync(password: string): readonly PasswordViolation[] {
  const violations: PasswordViolation[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    violations.push({
      code: "too_short",
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    violations.push({
      code: "too_long",
      message: `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`,
    });
  }

  for (const pattern of TRIVIAL_PATTERNS) {
    if (pattern.test(password)) {
      violations.push({
        code: "trivial_pattern",
        message: "Password is too simple or predictable.",
      });
      break; // one trivial-pattern violation is enough
    }
  }

  return violations;
}

/**
 * Compute an advisory strength score.
 * Based on character class diversity and entropy heuristics — not a
 * cryptographic measurement. Used purely to drive the UI strength meter.
 */
function computeStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (password.length < PASSWORD_MIN_LENGTH) return 0;

  let score = 0;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (password.length >= 20) score = Math.min(score + 1, 4);

  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

/**
 * Evaluate a candidate password against the full policy, including the
 * async breach check.
 *
 * Usage:
 *   const result = await checkPassword(candidate, breachChecker);
 *   if (!result.valid) showErrors(result.violations);
 */
export async function checkPassword(
  password: string,
  breachChecker: BreachChecker = NullBreachChecker,
): Promise<PasswordPolicyResult> {
  const syncViolations = checkSync(password);

  // Only run the async breach check if the password passes basic validation —
  // a trivially short password is already rejected and the network call adds latency.
  const breached =
    syncViolations.length === 0 ? await breachChecker.isBreached(password) : false;

  const violations: PasswordViolation[] = [...syncViolations];
  if (breached) {
    violations.push({
      code: "breached",
      message:
        "This password has appeared in a data breach. Please choose a different one.",
    });
  }

  const valid = violations.length === 0;
  const strengthScore = valid ? computeStrength(password) : 0;

  return { valid, violations, strengthScore };
}

/**
 * Synchronous check (no breach lookup) — for instant UI feedback while the
 * user is still typing. Always run the async check on final submission.
 */
export function checkPasswordSync(password: string): PasswordPolicyResult {
  const violations = checkSync(password);
  const valid = violations.length === 0;
  const strengthScore = valid ? computeStrength(password) : 0;
  return { valid, violations, strengthScore };
}
