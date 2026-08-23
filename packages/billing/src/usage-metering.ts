/**
 * Usage metering — records billable events, aggregates billing period totals,
 * and projects end-of-period usage for quota enforcement.
 *
 * DOUBLE-BILLING PROTECTION:
 *   Every record() call requires a caller-supplied idempotencyKey. The database
 *   unique constraint on usage_events.idempotency_key is the enforcement
 *   mechanism — a second write with the same key is silently ignored
 *   (ON CONFLICT DO NOTHING). Callers MUST use a stable key derived from the
 *   source event (e.g. submissionId + metric), never a random UUID per call.
 *
 * SYNTHETIC SUBMISSION EXCLUSION:
 *   Health-check submissions carry origin = "synthetic". These MUST NOT
 *   produce a 'submission_accepted' usage event. This is enforced here in
 *   code and validated by tests. The database schema also documents this
 *   constraint in the usageEvents table comment.
 *
 * All monetary and quantity values are integers. No floating point arithmetic
 * is used in this module.
 */

import type { QuotaKey } from "@submitpulse/config/entitlements";

/** The set of valid metric names, matching the usage_events.metric CHECK. */
export type UsageMetric =
  | "submission_accepted"
  | "form_created"
  | "health_test"
  | "ai_analysis"
  | "storage_bytes"
  | "file_bandwidth_bytes"
  | "email_delivered"
  | "webhook_attempt"
  | "member_added";

/** Maps UsageMetric → QuotaKey for entitlement checks. */
export const METRIC_TO_QUOTA_KEY: Partial<Record<UsageMetric, QuotaKey>> = {
  submission_accepted: "submissionsPerMonth",
  form_created: "forms",
  health_test: "healthTestsPerMonth",
  ai_analysis: "aiAnalysesPerMonth",
} as const;

export interface UsageEventInput {
  readonly workspaceId: string;
  readonly formId?: string;
  readonly metric: UsageMetric;
  /** Integer quantity — must be > 0. */
  readonly quantity: number;
  /**
   * Stable idempotency key derived from the source event. A retry with the
   * same key is silently ignored — this is the primary double-billing guard.
   * Suggested format: `<sourceType>:<sourceId>:<metric>` e.g.
   * `submission:sub_abc123:submission_accepted`
   */
  readonly idempotencyKey: string;
  /**
   * The origin of the submission that triggered this event. Callers MUST pass
   * this for submission_accepted events so the synthetic guard can fire.
   */
  readonly submissionOrigin?: "live" | "test" | "synthetic";
  readonly billingPeriodStart: Date;
  readonly occurredAt?: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface UsageSummary {
  readonly workspaceId: string;
  readonly billingPeriodStart: Date;
  /** Aggregated quantities per metric for the billing period. */
  readonly totals: Readonly<Partial<Record<UsageMetric, number>>>;
}

export interface UsageProjection {
  readonly workspaceId: string;
  readonly billingPeriodStart: Date;
  readonly billingPeriodEnd: Date;
  /** Current total as of now. */
  readonly currentTotals: Readonly<Partial<Record<UsageMetric, number>>>;
  /**
   * Projected totals at end of period, based on daily run rate.
   * Only meaningful if more than 3 days have elapsed in the period.
   */
  readonly projectedTotals: Readonly<Partial<Record<UsageMetric, number>>>;
  /** Days elapsed in the billing period. */
  readonly daysElapsed: number;
  /** Total days in the billing period. */
  readonly daysTotal: number;
}

/** Minimal DB adapter for usage metering. Caller provides a real implementation. */
export interface MeteringDb {
  /**
   * Insert a usage event. Must use ON CONFLICT DO NOTHING on idempotency_key.
   * Returns true if the row was actually inserted (false = duplicate / ignored).
   */
  insertUsageEvent(event: UsageEventInput): Promise<boolean>;

  /** Sum quantities per metric for the given workspace and billing period. */
  aggregatePeriod(
    workspaceId: string,
    billingPeriodStart: Date,
  ): Promise<Partial<Record<UsageMetric, number>>>;
}

export class UsageMeteringService {
  readonly #db: MeteringDb;

  constructor(db: MeteringDb) {
    this.#db = db;
  }

  /**
   * Record a billable event.
   *
   * Silently returns false if the idempotencyKey has already been recorded
   * (duplicate / retry). Returns true if the event was new.
   *
   * SYNTHETIC GUARD: if metric = "submission_accepted" and
   * submissionOrigin = "synthetic", the event is dropped without a DB write
   * and false is returned. Health-check submissions must NOT be billed.
   */
  async record(input: UsageEventInput): Promise<boolean> {
    // SYNTHETIC EXCLUSION GUARD — enforced in code and tested.
    // Synthetic health-check submissions must never produce a billable
    // submission_accepted event. This prevents the Pulse monitor from
    // inflating usage quotas and triggering incorrect billing.
    if (
      input.metric === "submission_accepted" &&
      input.submissionOrigin === "synthetic"
    ) {
      return false;
    }

    if (input.quantity <= 0) {
      throw new Error(
        `UsageMeteringService.record: quantity must be > 0, got ${input.quantity}`,
      );
    }

    // The DB layer enforces ON CONFLICT DO NOTHING on idempotency_key.
    // A false return means the row already existed — not an error.
    return this.#db.insertUsageEvent(input);
  }

  /** Aggregate all usage for a workspace's billing period. */
  async aggregatePeriod(workspaceId: string, billingPeriodStart: Date): Promise<UsageSummary> {
    const totals = await this.#db.aggregatePeriod(workspaceId, billingPeriodStart);
    return { workspaceId, billingPeriodStart, totals };
  }

  /**
   * Project end-of-period usage based on current run rate.
   * Uses integer arithmetic throughout — no floating point.
   */
  async projectUsage(
    workspaceId: string,
    billingPeriodStart: Date,
    billingPeriodEnd: Date,
  ): Promise<UsageProjection> {
    const totals = await this.#db.aggregatePeriod(workspaceId, billingPeriodStart);

    const now = new Date();
    const periodMs = billingPeriodEnd.getTime() - billingPeriodStart.getTime();
    const elapsedMs = Math.max(0, now.getTime() - billingPeriodStart.getTime());

    // Use integer day counts (floor) to avoid fractional arithmetic.
    const MS_PER_DAY = 86_400_000;
    const daysTotal = Math.floor(periodMs / MS_PER_DAY);
    const daysElapsed = Math.min(Math.floor(elapsedMs / MS_PER_DAY), daysTotal);

    const projectedTotals: Partial<Record<UsageMetric, number>> = {};
    if (daysElapsed >= 3 && daysTotal > 0) {
      for (const [metric, current] of Object.entries(totals) as Array<
        [UsageMetric, number | undefined]
      >) {
        if (current === undefined) continue;
        // Integer projection: (current / daysElapsed) * daysTotal — no floats.
        // Use multiply-then-divide to preserve precision.
        projectedTotals[metric] = Math.ceil((current * daysTotal) / daysElapsed);
      }
    }

    return {
      workspaceId,
      billingPeriodStart,
      billingPeriodEnd,
      currentTotals: totals,
      projectedTotals,
      daysElapsed,
      daysTotal,
    };
  }
}
