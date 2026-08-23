/**
 * CENTRALISED ENTITLEMENT ENGINE
 * ===============================
 *
 * Plan limits are defined exactly once, here. Feature code asks the engine a
 * question ("may this workspace create another form?") and never compares
 * plan names inline. The spec is explicit: do not scatter price limits
 * throughout the application.
 *
 * Adding a plan or changing a limit is a single-file change. Adding a *feature*
 * flag requires extending `FeatureKey`, which forces every plan to declare a
 * value for it — the compiler will not let a plan silently omit a feature.
 */

export const PLAN_IDS = ["free", "starter", "pro", "agency"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Boolean capabilities gated by plan. */
export const FEATURE_KEYS = [
  "autoresponders",
  "webhooks",
  "domainRules",
  "fileUploads",
  "advancedSpam",
  "pulseMonitor",
  "schemaDrift",
  "aiRepair",
  "integrations",
  "analytics",
  "mcpServer",
  "clientWorkspaces",
  "agencyDashboard",
  "whiteLabelReports",
  "prioritySupport",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Numeric quotas. `null` means unlimited. */
export const QUOTA_KEYS = [
  "forms",
  "submissionsPerMonth",
  "members",
  "historyDays",
  "fileStorageMb",
  "healthTestsPerMonth",
  "aiAnalysesPerMonth",
] as const;
export type QuotaKey = (typeof QUOTA_KEYS)[number];

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  /** Monthly price in the smallest currency unit (cents). */
  readonly priceMonthlyCents: number;
  /** Annual price in cents. Null when the plan is not offered annually. */
  readonly priceAnnualCents: number | null;
  readonly currency: "usd";
  readonly quotas: Readonly<Record<QuotaKey, number | null>>;
  readonly features: Readonly<Record<FeatureKey, boolean>>;
}

const f = (enabled: FeatureKey[]): Record<FeatureKey, boolean> =>
  Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, enabled.includes(k)]),
  ) as Record<FeatureKey, boolean>;

export const PLANS: Readonly<Record<PlanId, Plan>> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
    currency: "usd",
    quotas: {
      forms: 2,
      submissionsPerMonth: 100,
      members: 1,
      historyDays: 7,
      fileStorageMb: 0,
      healthTestsPerMonth: 0,
      aiAnalysesPerMonth: 0,
    },
    features: f([]),
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthlyCents: 900,
    priceAnnualCents: 9000,
    currency: "usd",
    quotas: {
      forms: 10,
      submissionsPerMonth: 1_000,
      members: 3,
      historyDays: 30,
      fileStorageMb: 0,
      healthTestsPerMonth: 0,
      aiAnalysesPerMonth: 0,
    },
    features: f(["autoresponders", "webhooks", "domainRules"]),
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyCents: 2900,
    priceAnnualCents: 29000,
    currency: "usd",
    quotas: {
      forms: 50,
      submissionsPerMonth: 10_000,
      members: 10,
      historyDays: 365,
      fileStorageMb: 25_000,
      healthTestsPerMonth: 20_000,
      aiAnalysesPerMonth: 500,
    },
    features: f([
      "autoresponders",
      "webhooks",
      "domainRules",
      "fileUploads",
      "advancedSpam",
      "pulseMonitor",
      "schemaDrift",
      "aiRepair",
      "integrations",
      "analytics",
      "mcpServer",
    ]),
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceMonthlyCents: 7900,
    priceAnnualCents: 79000,
    currency: "usd",
    quotas: {
      forms: 250,
      submissionsPerMonth: 50_000,
      members: 25,
      historyDays: 365 * 2,
      fileStorageMb: 150_000,
      healthTestsPerMonth: 100_000,
      aiAnalysesPerMonth: 2_500,
    },
    features: f([
      "autoresponders",
      "webhooks",
      "domainRules",
      "fileUploads",
      "advancedSpam",
      "pulseMonitor",
      "schemaDrift",
      "aiRepair",
      "integrations",
      "analytics",
      "mcpServer",
      "clientWorkspaces",
      "agencyDashboard",
      "whiteLabelReports",
      "prioritySupport",
    ]),
  },
} as const;

export const ORDERED_PLANS: readonly Plan[] = PLAN_IDS.map((id) => PLANS[id]);

/* -------------------------------------------------------------------------- */
/* Engine                                                                      */
/* -------------------------------------------------------------------------- */

export interface EntitlementContext {
  readonly plan: PlanId;
  /** Current measured usage for the billing period. */
  readonly usage: Partial<Record<QuotaKey, number>>;
}

export type QuotaVerdict =
  | { readonly allowed: true; readonly remaining: number | null }
  | {
      readonly allowed: false;
      readonly reason: "quota_exceeded";
      readonly limit: number;
      readonly current: number;
      readonly upgradeTo: PlanId | null;
    };

export type FeatureVerdict =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: "feature_not_in_plan";
      readonly upgradeTo: PlanId | null;
    };

/** Lowest plan that includes a given feature, or null if none do. */
export function lowestPlanWithFeature(feature: FeatureKey): PlanId | null {
  for (const plan of ORDERED_PLANS) {
    if (plan.features[feature]) return plan.id;
  }
  return null;
}

/** Lowest plan whose quota strictly exceeds `needed`, or null. */
export function lowestPlanWithQuota(
  quota: QuotaKey,
  needed: number,
): PlanId | null {
  for (const plan of ORDERED_PLANS) {
    const limit = plan.quotas[quota];
    if (limit === null || limit >= needed) return plan.id;
  }
  return null;
}

export function canUseFeature(
  ctx: EntitlementContext,
  feature: FeatureKey,
): FeatureVerdict {
  if (PLANS[ctx.plan].features[feature]) return { allowed: true };
  return {
    allowed: false,
    reason: "feature_not_in_plan",
    upgradeTo: lowestPlanWithFeature(feature),
  };
}

/**
 * Check whether `amount` more of a metered resource may be consumed.
 * `amount` defaults to 1 (the "may I create one more?" case).
 */
export function checkQuota(
  ctx: EntitlementContext,
  quota: QuotaKey,
  amount = 1,
): QuotaVerdict {
  const limit = PLANS[ctx.plan].quotas[quota];
  if (limit === null) return { allowed: true, remaining: null };

  const current = ctx.usage[quota] ?? 0;
  const projected = current + amount;

  if (projected > limit) {
    return {
      allowed: false,
      reason: "quota_exceeded",
      limit,
      current,
      upgradeTo: lowestPlanWithQuota(quota, projected),
    };
  }
  return { allowed: true, remaining: limit - projected };
}

/** Retention window for submission history, in days. */
export function retentionDays(plan: PlanId): number | null {
  return PLANS[plan].quotas.historyDays;
}

/** Human-readable quota limit for UI. */
export function formatQuota(limit: number | null): string {
  return limit === null ? "Unlimited" : limit.toLocaleString("en-US");
}
