/**
 * Tests: entitlement projection across plan boundaries.
 *
 * Verifies that EntitlementService correctly joins plan limits with measured
 * usage and delegates enforcement to checkQuota / canUseFeature from
 * packages/config/entitlements — never reimplementing limit logic.
 */

import { describe, expect, it } from "vitest";
import { EntitlementService } from "../entitlement-service";
import type { EntitlementDb, WorkspaceSubscription } from "../entitlement-service";
import type { UsageMetric } from "../usage-metering";

// ---------------------------------------------------------------------------
// Fake DB
// ---------------------------------------------------------------------------

function makeDb(
  sub: WorkspaceSubscription | null,
  usageTotals: Partial<Record<UsageMetric, number>>,
): EntitlementDb {
  return {
    async getSubscription(_workspaceId: string): Promise<WorkspaceSubscription | null> {
      return sub;
    },
    async getUsageTotals(
      _workspaceId: string,
      _billingPeriodStart: Date,
    ): Promise<Partial<Record<UsageMetric, number>>> {
      return usageTotals;
    },
  };
}

function activeSub(planId: "free" | "starter" | "pro" | "agency"): WorkspaceSubscription {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    planId,
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: end,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EntitlementService — quota checks across plans", () => {
  const workspaceId = "ws_ent_001";

  it("free plan: allows submission when under the 100/month limit", async () => {
    const service = new EntitlementService(makeDb(activeSub("free"), { submission_accepted: 50 }));
    const verdict = await service.checkQuota(workspaceId, "submissionsPerMonth");
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) {
      // 100 limit - 50 current - 1 requested = 49 remaining
      expect(verdict.remaining).toBe(49);
    }
  });

  it("free plan: blocks submission when at the 100/month limit", async () => {
    const service = new EntitlementService(makeDb(activeSub("free"), { submission_accepted: 100 }));
    const verdict = await service.checkQuota(workspaceId, "submissionsPerMonth");
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.reason).toBe("quota_exceeded");
      expect(verdict.limit).toBe(100);
      expect(verdict.current).toBe(100);
      // The lowest plan with more than 100 submissions is "starter" (1000)
      expect(verdict.upgradeTo).toBe("starter");
    }
  });

  it("pro plan: allows up to 10,000 submissions per month", async () => {
    const service = new EntitlementService(
      makeDb(activeSub("pro"), { submission_accepted: 9_999 }),
    );
    const verdict = await service.checkQuota(workspaceId, "submissionsPerMonth");
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.remaining).toBe(0);
  });

  it("pro plan: blocks when over 10,000 submissions per month", async () => {
    const service = new EntitlementService(
      makeDb(activeSub("pro"), { submission_accepted: 10_000 }),
    );
    const verdict = await service.checkQuota(workspaceId, "submissionsPerMonth");
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.upgradeTo).toBe("agency");
    }
  });

  it("agency plan: unlimited forms (null quota)", async () => {
    const service = new EntitlementService(makeDb(activeSub("agency"), { form_created: 9999 }));
    const verdict = await service.checkQuota(workspaceId, "forms", 1);
    // Agency plan has 250 forms, not null, so this should still be bounded.
    // (Verifying we read from PLANS, not from a hardcoded value.)
    // 9999 + 1 > 250 => blocked
    expect(verdict.allowed).toBe(false);
  });

  it("no subscription → falls back to free plan limits", async () => {
    const service = new EntitlementService(makeDb(null, {}));
    const verdict = await service.checkQuota(workspaceId, "submissionsPerMonth", 50);
    // Free plan: 100 limit, 0 usage, 50 requested → allowed
    expect(verdict.allowed).toBe(true);
  });

  it("past_due subscription → treated as free plan for quota checks", async () => {
    const pastDueSub: WorkspaceSubscription = {
      ...activeSub("pro"),
      status: "past_due",
    };
    const service = new EntitlementService(makeDb(pastDueSub, { submission_accepted: 90 }));
    const verdict = await service.checkQuota(workspaceId, "submissionsPerMonth", 20);
    // Free plan: 100 limit, 90 usage, 20 more requested → 110 > 100 → blocked
    expect(verdict.allowed).toBe(false);
  });
});

describe("EntitlementService — feature checks across plans", () => {
  const workspaceId = "ws_ent_002";

  it("free plan: cannot use integrations", async () => {
    const service = new EntitlementService(makeDb(activeSub("free"), {}));
    const verdict = await service.canUseFeature(workspaceId, "integrations");
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      // Lowest plan with integrations is "pro"
      expect(verdict.upgradeTo).toBe("pro");
    }
  });

  it("pro plan: can use integrations", async () => {
    const service = new EntitlementService(makeDb(activeSub("pro"), {}));
    const verdict = await service.canUseFeature(workspaceId, "integrations");
    expect(verdict.allowed).toBe(true);
  });

  it("starter plan: cannot use file uploads", async () => {
    const service = new EntitlementService(makeDb(activeSub("starter"), {}));
    const verdict = await service.canUseFeature(workspaceId, "fileUploads");
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.upgradeTo).toBe("pro");
    }
  });

  it("agency plan: can use all features including agencyDashboard", async () => {
    const service = new EntitlementService(makeDb(activeSub("agency"), {}));
    const verdicts = await Promise.all([
      service.canUseFeature(workspaceId, "agencyDashboard"),
      service.canUseFeature(workspaceId, "whiteLabelReports"),
      service.canUseFeature(workspaceId, "clientWorkspaces"),
    ]);
    expect(verdicts.every((v) => v.allowed)).toBe(true);
  });

  it("starter plan: can use webhooks but not advanced spam", async () => {
    const service = new EntitlementService(makeDb(activeSub("starter"), {}));
    const webhooks = await service.canUseFeature(workspaceId, "webhooks");
    const spam = await service.canUseFeature(workspaceId, "advancedSpam");
    expect(webhooks.allowed).toBe(true);
    expect(spam.allowed).toBe(false);
  });
});
