/**
 * EntitlementService — joins a workspace's subscription plan with measured
 * usage to produce an EntitlementContext, then delegates to the canonical
 * checkQuota / canUseFeature functions in packages/config/entitlements.
 *
 * DESIGN CONTRACT:
 *   - Limit logic lives in entitlements.ts. This service NEVER redefines or
 *     re-derives plan limits. It only assembles the EntitlementContext and
 *     calls the engine.
 *   - Plan limits are read from PLANS[planId] in entitlements.ts — never from
 *     the database or a local constant.
 *   - Usage is read from the metering aggregate for the current billing period.
 */

import type {
  EntitlementContext,
  FeatureKey,
  FeatureVerdict,
  PlanId,
  QuotaKey,
  QuotaVerdict,
} from "@submitpulse/config/entitlements";
import { canUseFeature, checkQuota } from "@submitpulse/config/entitlements";
import type { UsageMetric } from "./usage-metering";
import { METRIC_TO_QUOTA_KEY } from "./usage-metering";

/** Minimal subscription information needed for entitlement checks. */
export interface WorkspaceSubscription {
  readonly planId: PlanId;
  readonly status: string;
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
}

/** DB adapter to fetch subscription and aggregated usage. */
export interface EntitlementDb {
  /** Fetch the active subscription for a workspace, or null if on free plan. */
  getSubscription(workspaceId: string): Promise<WorkspaceSubscription | null>;

  /**
   * Sum metered quantities per metric for the current billing period.
   * The key is a UsageMetric string.
   */
  getUsageTotals(
    workspaceId: string,
    billingPeriodStart: Date,
  ): Promise<Partial<Record<UsageMetric, number>>>;
}

/** Maps UsageMetric totals to the QuotaKey shape expected by EntitlementContext. */
function mapUsageToQuotas(
  metricTotals: Partial<Record<UsageMetric, number>>,
): Partial<Record<QuotaKey, number>> {
  const result: Partial<Record<QuotaKey, number>> = {};
  for (const [metric, count] of Object.entries(metricTotals) as Array<
    [UsageMetric, number | undefined]
  >) {
    const quotaKey = METRIC_TO_QUOTA_KEY[metric];
    if (quotaKey !== undefined && count !== undefined) {
      result[quotaKey] = count;
    }
  }
  return result;
}

export class EntitlementService {
  readonly #db: EntitlementDb;

  constructor(db: EntitlementDb) {
    this.#db = db;
  }

  /**
   * Build the EntitlementContext for a workspace.
   * Reads subscription from DB; falls back to free plan if none exists or the
   * subscription is in a non-active state (past_due, canceled, etc.).
   */
  async buildContext(workspaceId: string): Promise<EntitlementContext> {
    const sub = await this.#db.getSubscription(workspaceId);

    // If no subscription, or subscription is not active/trialing, use free plan.
    const activeStatuses = new Set(["active", "trialing"]);
    const planId: PlanId =
      sub !== null && activeStatuses.has(sub.status) ? sub.planId : "free";

    // For usage: use the billing period if available, otherwise the current month.
    const periodStart =
      sub?.currentPeriodStart ?? startOfCurrentMonth();

    const metricTotals = await this.#db.getUsageTotals(workspaceId, periodStart);
    const usage = mapUsageToQuotas(metricTotals);

    return { plan: planId, usage };
  }

  /**
   * Check whether a workspace may consume `amount` more of a given quota.
   * Delegates entirely to entitlements.checkQuota — no limit logic here.
   */
  async checkQuota(
    workspaceId: string,
    quota: QuotaKey,
    amount = 1,
  ): Promise<QuotaVerdict> {
    const ctx = await this.buildContext(workspaceId);
    return checkQuota(ctx, quota, amount);
  }

  /**
   * Check whether a workspace may use a feature.
   * Delegates entirely to entitlements.canUseFeature — no limit logic here.
   */
  async canUseFeature(workspaceId: string, feature: FeatureKey): Promise<FeatureVerdict> {
    const ctx = await this.buildContext(workspaceId);
    return canUseFeature(ctx, feature);
  }
}

/** Start of the current UTC calendar month. */
function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
