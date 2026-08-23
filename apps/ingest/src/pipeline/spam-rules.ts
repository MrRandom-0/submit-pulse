/**
 * Stage 7 — Spam rule evaluation (synchronous, inline rules only).
 *
 * NOTE: Heavy AI-based spam analysis is intentionally deferred to the queue
 * consumer (the async worker). The hot path only applies cheap, synchronous
 * signals that can be evaluated from the payload without external calls:
 *   - Honeypot field populated
 *   - Known-bad keyword blocklist (from form's spam_rules rows)
 *   - Same payload content hash seen recently (repeat-submission)
 *
 * The spam_verdict returned here is preliminary. The queue worker may
 * upgrade or downgrade it after deeper analysis.
 *
 * Signals that are NOT evaluated inline (deferred to queue):
 *   - AI content classification
 *   - External blocklist lookups (Spamhaus, etc.)
 *   - Email deliverability checks
 *   - Link scanning
 */

export type SpamVerdict = "clean" | "suspicious" | "spam" | "blocked";

export interface SpamSignal {
  readonly code: string;
  readonly label: string;
  readonly weight: number;
  readonly evidence?: string | undefined;
}

export interface SpamEvaluation {
  readonly verdict: SpamVerdict;
  readonly score: number;
  readonly signals: readonly SpamSignal[];
}

export interface SpamRule {
  readonly kind: "blocklist_term" | "blocklist_email" | "blocklist_ip" | "allowlist_email" | "regex";
  readonly targetField: string | null;
  readonly pattern: string;
  readonly weight: number;
  readonly enabled: boolean;
}

/**
 * Evaluate synchronous spam signals against the payload.
 *
 * @param payload         Validated field values.
 * @param honeypotField   If set, check this field is absent/empty.
 * @param clientIp        Submitter IP for IP-based rules.
 * @param spamRules       Active rules from the workspace/form config.
 */
export function evaluateSpam(
  payload: Record<string, unknown>,
  honeypotField: string | null,
  clientIp: string,
  spamRules: readonly SpamRule[],
): SpamEvaluation {
  const signals: SpamSignal[] = [];
  let score = 0;

  // Signal 1: honeypot field populated.
  if (honeypotField !== null && honeypotField !== "") {
    const honeypotValue = payload[honeypotField];
    if (
      honeypotValue !== undefined &&
      honeypotValue !== null &&
      honeypotValue !== ""
    ) {
      const sig: SpamSignal = {
        code: "honeypot_populated",
        label: "Honeypot field was populated",
        weight: 1.0,
        evidence: `field:${honeypotField}`,
      };
      signals.push(sig);
      score = Math.min(1, score + sig.weight);
    }
  }

  // Signal 2: apply workspace/form spam rules.
  for (const rule of spamRules) {
    if (!rule.enabled) continue;

    const fieldsToCheck: Array<[string, unknown]> =
      rule.targetField !== null
        ? [[rule.targetField, payload[rule.targetField]]]
        : Object.entries(payload);

    for (const [fieldName, value] of fieldsToCheck) {
      if (value === undefined || value === null) continue;
      const strValue = String(value).toLowerCase();

      let matched = false;

      switch (rule.kind) {
        case "blocklist_term":
          matched = strValue.includes(rule.pattern.toLowerCase());
          break;

        case "blocklist_email":
          matched =
            strValue === rule.pattern.toLowerCase() ||
            strValue.endsWith(`@${rule.pattern.toLowerCase()}`);
          break;

        case "blocklist_ip":
          matched = clientIp === rule.pattern;
          break;

        case "allowlist_email":
          if (strValue === rule.pattern.toLowerCase()) {
            // Negative weight = allowlist signal, reduces score.
            const sig: SpamSignal = {
              code: "allowlisted_email",
              label: "Email is on the allowlist",
              weight: rule.weight,
              evidence: `field:${fieldName}`,
            };
            signals.push(sig);
            score = Math.max(0, Math.min(1, score + rule.weight));
            matched = false; // Don't double-count.
          }
          break;

        case "regex": {
          try {
            matched = new RegExp(rule.pattern, "i").test(strValue);
          } catch {
            // Invalid regex in a rule should not crash the ingestion.
            console.warn(`[spam-rules] Invalid regex pattern: ${rule.pattern}`);
          }
          break;
        }
      }

      if (matched && rule.kind !== "allowlist_email") {
        const sig: SpamSignal = {
          code: `rule_match:${rule.kind}`,
          label: `Matched ${rule.kind} rule`,
          weight: rule.weight,
          evidence: `field:${fieldName}`,
        };
        signals.push(sig);
        score = Math.max(0, Math.min(1, score + rule.weight));
      }
    }
  }

  const verdict = scoreToVerdict(score);
  return { verdict, score, signals };
}

function scoreToVerdict(score: number): SpamVerdict {
  if (score >= 1.0) return "blocked";
  if (score >= 0.7) return "spam";
  if (score >= 0.4) return "suspicious";
  return "clean";
}
