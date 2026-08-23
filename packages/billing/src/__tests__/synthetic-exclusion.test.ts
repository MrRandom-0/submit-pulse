/**
 * Tests: synthetic health-check submissions must NOT produce billable events.
 *
 * Health-check submissions (origin = "synthetic") must be excluded from
 * usage metering entirely. This prevents the Pulse monitor from inflating
 * submission quotas and incorrectly triggering billing or quota limits.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { UsageMeteringService } from "../usage-metering";
import type { MeteringDb, UsageEventInput, UsageMetric } from "../usage-metering";

class FakeMeteringDb implements MeteringDb {
  readonly insertedEvents: UsageEventInput[] = [];

  async insertUsageEvent(event: UsageEventInput): Promise<boolean> {
    this.insertedEvents.push(event);
    return true;
  }

  async aggregatePeriod(
    workspaceId: string,
    _billingPeriodStart: Date,
  ): Promise<Partial<Record<UsageMetric, number>>> {
    const totals: Partial<Record<UsageMetric, number>> = {};
    for (const event of this.insertedEvents) {
      if (event.workspaceId !== workspaceId) continue;
      const existing = totals[event.metric] ?? 0;
      totals[event.metric] = existing + event.quantity;
    }
    return totals;
  }
}

describe("UsageMeteringService — synthetic exclusion", () => {
  let db: FakeMeteringDb;
  let service: UsageMeteringService;
  const billingPeriodStart = new Date("2026-08-01T00:00:00Z");
  const workspaceId = "ws_test_synth";

  beforeEach(() => {
    db = new FakeMeteringDb();
    service = new UsageMeteringService(db);
  });

  it("does NOT record submission_accepted for synthetic origin", async () => {
    const result = await service.record({
      workspaceId,
      metric: "submission_accepted",
      quantity: 1,
      idempotencyKey: "submission:synth_001:submission_accepted",
      submissionOrigin: "synthetic",
      billingPeriodStart,
    });

    expect(result).toBe(false);
    expect(db.insertedEvents).toHaveLength(0);
  });

  it("returns false (not an error) for synthetic submissions — allows silent exclusion", async () => {
    // Caller must be able to silently skip without throwing.
    await expect(
      service.record({
        workspaceId,
        metric: "submission_accepted",
        quantity: 1,
        idempotencyKey: "submission:synth_002:submission_accepted",
        submissionOrigin: "synthetic",
        billingPeriodStart,
      }),
    ).resolves.toBe(false);
  });

  it("DOES record submission_accepted for live origin", async () => {
    const result = await service.record({
      workspaceId,
      metric: "submission_accepted",
      quantity: 1,
      idempotencyKey: "submission:live_001:submission_accepted",
      submissionOrigin: "live",
      billingPeriodStart,
    });

    expect(result).toBe(true);
    expect(db.insertedEvents).toHaveLength(1);
  });

  it("DOES record submission_accepted for test origin", async () => {
    const result = await service.record({
      workspaceId,
      metric: "submission_accepted",
      quantity: 1,
      idempotencyKey: "submission:test_001:submission_accepted",
      submissionOrigin: "test",
      billingPeriodStart,
    });

    expect(result).toBe(true);
    expect(db.insertedEvents).toHaveLength(1);
  });

  it("mixed synthetic and live: aggregate reflects only live submissions", async () => {
    // 3 live submissions
    for (let i = 1; i <= 3; i++) {
      await service.record({
        workspaceId,
        metric: "submission_accepted",
        quantity: 1,
        idempotencyKey: `submission:live_${i}:submission_accepted`,
        submissionOrigin: "live",
        billingPeriodStart,
      });
    }
    // 5 synthetic submissions that must be excluded
    for (let i = 1; i <= 5; i++) {
      await service.record({
        workspaceId,
        metric: "submission_accepted",
        quantity: 1,
        idempotencyKey: `submission:synth_${i}:submission_accepted`,
        submissionOrigin: "synthetic",
        billingPeriodStart,
      });
    }

    const summary = await service.aggregatePeriod(workspaceId, billingPeriodStart);
    // Only 3 — the 5 synthetic events must not appear.
    expect(summary.totals["submission_accepted"]).toBe(3);
    expect(db.insertedEvents).toHaveLength(3);
  });

  it("synthetic guard only applies to submission_accepted, not other metrics", async () => {
    // health_test events from the synthetic monitor ARE billable (health quota)
    const result = await service.record({
      workspaceId,
      metric: "health_test",
      quantity: 1,
      idempotencyKey: "health:synth_001:health_test",
      submissionOrigin: "synthetic",
      billingPeriodStart,
    });
    // health_test is not submission_accepted, so the guard does not apply.
    expect(result).toBe(true);
    expect(db.insertedEvents).toHaveLength(1);
  });
});
