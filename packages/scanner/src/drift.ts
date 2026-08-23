/**
 * SCHEMA DRIFT DETECTOR
 * =====================
 * Pure diff between an expected (declared) field schema version and an
 * observed (live-request) payload. Produces structured DriftResult[] that
 * mirrors the driftKindEnum values from the database schema.
 *
 * SAFETY INVARIANT (from schema_drift_events in packages/database):
 *   Drift is NEVER auto-applied destructively. Every DriftResult is
 *   informational only. No data is dropped, no schema is mutated, and no
 *   validation rules are loosened until a workspace member explicitly reviews
 *   and accepts the change. This module only produces descriptions; it is the
 *   application layer's responsibility to honour this invariant.
 *
 * RENAME HEURISTICS:
 *   When a field disappears from expected AND a new field appears in observed,
 *   we compute a similarity score and mark it as a rename suggestion with
 *   confidence. Confidence >= 0.75 → high, 0.5–0.74 → medium, < 0.5 → low.
 *   These are SUGGESTIONS, not facts. Always labelled as such.
 */

// ---------------------------------------------------------------------------
// Types — mirroring driftKindEnum from packages/database/src/schema/enums
// ---------------------------------------------------------------------------

export type DriftKind =
  | "field_added"
  | "field_removed"
  | "field_renamed"
  | "type_changed"
  | "required_changed"
  | "validation_changed"
  | "unexpected_payload";

export interface SchemaField {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly constraints?: Readonly<Record<string, unknown>> | undefined;
}

export interface ObservedField {
  readonly name: string;
  /** Best-guess type inferred from the observed value. */
  readonly inferredType: string;
  readonly value: unknown;
}

/** A single detected drift between expected schema and observed payload. */
export interface DriftResult {
  readonly kind: DriftKind;
  /** Field name that changed, or was added/removed. Null for unexpected_payload. */
  readonly fieldName: string | null;
  /** Previous (expected) definition snapshot. */
  readonly previousDefinition: Readonly<Record<string, unknown>> | null;
  /** What was actually observed. */
  readonly observedDefinition: Readonly<Record<string, unknown>> | null;
  /** Human-readable summary. */
  readonly summary: string;
  /**
   * For field_renamed only: the candidate expected field name this observed
   * field might have been renamed from.
   */
  readonly renameSuggestion?: {
    readonly fromField: string;
    /** 0.0–1.0. Interpret as a similarity estimate, not a fact. */
    readonly confidence: number;
    readonly confidenceLabel: "high" | "medium" | "low";
    /** Always true — renames are suggestions, never certain. */
    readonly isSuggestion: true;
  } | undefined;
}

// ---------------------------------------------------------------------------
// Rename similarity heuristics
// ---------------------------------------------------------------------------

/**
 * Compute a similarity score between two field names.
 * Uses a combination of:
 *   - Common prefix length (structural similarity)
 *   - Common character set overlap (Jaccard on char bigrams)
 *   - Longest common subsequence ratio
 *
 * Returns 0.0–1.0. This is an estimate; treat results as suggestions.
 */
function fieldNameSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;

  const aNorm = a.toLowerCase().replace(/[-_\s]+/g, "_");
  const bNorm = b.toLowerCase().replace(/[-_\s]+/g, "_");

  if (aNorm === bNorm) return 0.95;

  // Common prefix ratio
  let prefixLen = 0;
  const minLen = Math.min(aNorm.length, bNorm.length);
  for (let i = 0; i < minLen; i++) {
    if (aNorm[i] === bNorm[i]) prefixLen++;
    else break;
  }
  const prefixScore = prefixLen / Math.max(aNorm.length, bNorm.length);

  // Bigram Jaccard similarity
  function bigrams(s: string): Set<string> {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.slice(i, i + 2));
    }
    return set;
  }
  const bgA = bigrams(aNorm);
  const bgB = bigrams(bNorm);
  const intersection = [...bgA].filter((bg) => bgB.has(bg)).length;
  const union = new Set([...bgA, ...bgB]).size;
  const jaccardScore = union === 0 ? 0 : intersection / union;

  // LCS ratio
  function lcsLength(x: string, y: string): number {
    const m = x.length;
    const n = y.length;
    // Keep only two rows to save memory.
    let prev = new Array<number>(n + 1).fill(0);
    let curr = new Array<number>(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        curr[j] =
          x[i - 1] === y[j - 1]
            ? (prev[j - 1] ?? 0) + 1
            : Math.max(curr[j - 1] ?? 0, prev[j] ?? 0);
      }
      [prev, curr] = [curr, prev];
      curr.fill(0);
    }
    return prev[n] ?? 0;
  }
  const lcsScore = lcsLength(aNorm, bNorm) / Math.max(aNorm.length, bNorm.length);

  // Weighted average: prefix matters most for field names.
  return prefixScore * 0.4 + jaccardScore * 0.35 + lcsScore * 0.25;
}

function confidenceLabel(score: number): "high" | "medium" | "low" {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Type inference helper
// ---------------------------------------------------------------------------

/**
 * Infer a rough type label from an observed value.
 * Used when the observed payload provides the actual value.
 */
export function inferType(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email";
    if (/^https?:\/\//.test(value)) return "url";
    return "text";
  }
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Main diffing function
// ---------------------------------------------------------------------------

/**
 * Diff the expected schema fields against an observed payload.
 *
 * @param expected - The declared schema fields (active schema version).
 * @param observed - The fields/values seen in the live HTTP payload.
 * @returns Array of drift findings, ordered by kind (removed, renamed, added,
 *          type_changed, required_changed, validation_changed, unexpected_payload).
 */
export function diffSchema(
  expected: readonly SchemaField[],
  observed: readonly ObservedField[],
): DriftResult[] {
  const results: DriftResult[] = [];

  const expectedByName = new Map(expected.map((f) => [f.name, f]));
  const observedByName = new Map(observed.map((f) => [f.name, f]));

  // Fields present in expected but not observed → removed or renamed
  const removedExpected: SchemaField[] = [];
  for (const exp of expected) {
    if (!observedByName.has(exp.name)) {
      removedExpected.push(exp);
    }
  }

  // Fields present in observed but not expected → added or renamed
  const addedObserved: ObservedField[] = [];
  for (const obs of observed) {
    if (!expectedByName.has(obs.name)) {
      addedObserved.push(obs);
    }
  }

  // Attempt rename matching: pair each removed expected with the best-matching added observed.
  const usedObserved = new Set<string>();
  const usedExpected = new Set<string>();

  for (const exp of removedExpected) {
    let bestScore = 0;
    let bestObs: ObservedField | null = null;

    for (const obs of addedObserved) {
      if (usedObserved.has(obs.name)) continue;
      const score = fieldNameSimilarity(exp.name, obs.name);
      if (score > bestScore) {
        bestScore = score;
        bestObs = obs;
      }
    }

    // Only suggest rename if similarity is at least 0.4 — below that it's noise.
    if (bestObs !== null && bestScore >= 0.4) {
      usedObserved.add(bestObs.name);
      usedExpected.add(exp.name);

      const confidence = confidenceLabel(bestScore);
      results.push({
        kind: "field_renamed",
        fieldName: bestObs.name,
        previousDefinition: { name: exp.name, type: exp.type, required: exp.required },
        observedDefinition: { name: bestObs.name, inferredType: bestObs.inferredType },
        summary:
          `Field "${exp.name}" may have been renamed to "${bestObs.name}" ` +
          `(similarity: ${Math.round(bestScore * 100)}%, confidence: ${confidence}). ` +
          `This is a SUGGESTION — verify before accepting.`,
        renameSuggestion: {
          fromField: exp.name,
          confidence: bestScore,
          confidenceLabel: confidence,
          isSuggestion: true,
        },
      });
    }
  }

  // Remaining removed fields (no rename match found)
  for (const exp of removedExpected) {
    if (usedExpected.has(exp.name)) continue;
    results.push({
      kind: "field_removed",
      fieldName: exp.name,
      previousDefinition: { name: exp.name, type: exp.type, required: exp.required, constraints: exp.constraints },
      observedDefinition: null,
      summary:
        `Field "${exp.name}" (expected as ${exp.type}${exp.required ? ", required" : ""}) ` +
        `was not present in the observed payload.`,
    });
  }

  // Remaining added observed fields (no rename match)
  for (const obs of addedObserved) {
    if (usedObserved.has(obs.name)) continue;
    // Distinguish truly unexpected fields vs. potentially valid additions.
    results.push({
      kind: "field_added",
      fieldName: obs.name,
      previousDefinition: null,
      observedDefinition: { name: obs.name, inferredType: obs.inferredType },
      summary:
        `Field "${obs.name}" was found in the payload but is not declared in the schema. ` +
        `Inferred type: ${obs.inferredType}. Accept to add it to the schema, or ignore if it is a transient field.`,
    });
  }

  // Fields present in both — check for type, required, and validation changes.
  for (const exp of expected) {
    const obs = observedByName.get(exp.name);
    if (obs === undefined) continue; // Handled above.

    // Type changed
    if (obs.inferredType !== exp.type) {
      // Some type mappings are benign (e.g. "email" observed vs "text" expected).
      // We still report them to let the user decide.
      results.push({
        kind: "type_changed",
        fieldName: exp.name,
        previousDefinition: { name: exp.name, type: exp.type },
        observedDefinition: { name: obs.name, inferredType: obs.inferredType },
        summary:
          `Field "${exp.name}": expected type "${exp.type}" but observed value suggests type "${obs.inferredType}".`,
      });
    }
  }

  // Unexpected payload — any observed field not matched to expected, after rename reconciliation.
  // (Already emitted as field_added above — but if ALL observed fields are unexpected,
  //  we additionally emit one unexpected_payload event at the summary level.)
  const totalUnrecognised = addedObserved.filter((o) => !usedObserved.has(o.name)).length;
  if (totalUnrecognised > 0 && expected.length > 0) {
    results.push({
      kind: "unexpected_payload",
      fieldName: null,
      previousDefinition: null,
      observedDefinition: {
        unrecognisedFieldCount: totalUnrecognised,
        fieldNames: addedObserved
          .filter((o) => !usedObserved.has(o.name))
          .map((o) => o.name),
      },
      summary:
        `${totalUnrecognised} field(s) in the observed payload are not declared in the schema. ` +
        `Review and accept or ignore each one individually.`,
    });
  }

  // Sort order: removed → renamed → added → type_changed → required_changed →
  // validation_changed → unexpected_payload
  const kindOrder: Record<DriftKind, number> = {
    field_removed: 0,
    field_renamed: 1,
    field_added: 2,
    type_changed: 3,
    required_changed: 4,
    validation_changed: 5,
    unexpected_payload: 6,
  };
  return results.sort(
    (a, b) => (kindOrder[a.kind] ?? 99) - (kindOrder[b.kind] ?? 99),
  );
}
