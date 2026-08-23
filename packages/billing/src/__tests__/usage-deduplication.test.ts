/**
 * Tests: usage event deduplication (no double-billing on retry).
 *
 * The core invariant: recording the same idempotencyKey twice must result in
 * only one event being counted. The DB layer enforces ON CONFLICT DO NOTHING;
 * these tests verify the service-layer behaviour using an in-memory fake.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { UsageMeteringService } from "../usage-metering";
import type { MeteringDb, UsageEventInput, UsageMetric } from "../usage-metering";

// ---------------------------------------------------------------------------
// In-memory MeteringDb fake
// ---------------------------------------------------------------------------

class FakeMeteringDb implements MeteringDb {
  readonly #events = new Map<string, UsageEventInput>();

  async insertUsageEvent(event: UsageEventInput): Promise<boolean> {
    if (this.#events.has(event.idempotencyKey)) {
      // Simulate ON CONFLICT DO NOTHING
      return false;
    }
    this.#events.set(event.idempotencyKey, event);
    return true;
  }

  async aggregatePeriod(
    workspaceId: string,
    _billingPeriodStart: Date,
  ): Promise<Partial<Record<UsageMetric, number>>> {
    const totals: Partial<Record<UsageMetric, number>> = {};
    for (const event of this.#events.values()) {
      if (event.workspaceId !== workspaceId) continue;
      const existing = totals[event.metric] ?? 0;
      totals[event.metric] = existing + event.quantity;
    }
    return totals;
  }

  get eventCount(): number {
    return this.#events.size;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UsageMeteringService — deduplication", () => {
  let db: FakeMeteringDb;
  let service: UsageMeteringService;
  const billingPeriodStart = new Date("2026-08-01T00:00:00Z");
  const workspaceId = "ws_test_001";

  beforeEach(() => {
    db = new FakeMeteringDb();
    service = new UsageMeteringService(db);
  });

  it("records a new event and returns true", async () => {
    const result = await service.record({
      workspaceId,
      metric: "submission_accepted",
      quantity: 1,
      idempotencyKey: "submission:sub_001:submission_accepted",
      submissionOrigin: "live",
      billingPeriodStart,
    });
    expect(result).toBe(true);
  });

  it("silently ignores a duplicate idempotencyKey and returns false", async () => {
    const input: UsageEventInput = {
      workspaceId,
      metric: "submission_accepted",
      quantity: 1,
      idempotencyKey: "submission:sub_001:submission_accepted",
      submissionOrigin: "live",
      billingPeriodStart,
    };

    const first = await service.record(input);
    const second = await service.record(input);
    const third = await service.record(input);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(third).toBe(false);
    // Only one row should have been written.
    expect(db.eventCount).toBe(1);
  });

  it("counts only non-duplicate events in the aggregate", async () => {
    // First legitimate event
    await service.record({
      workspaceId,
      metric: "submission_accepted",
      quantity: 1,
      idempotencyKey: "submission:sub_001:submission_accepted",
      submissionOrigin: "live",
      billingPeriodStart,
    });

    // Retry of the same event (same idempotencyKey) — must not double-count
    await service.record({
      workspaceId,
      metric: "submission_accepted",
      quantity: 1,
      idempotencyKey: "submission:sub_001:submission_accepted",
      submissionOrigin: "live",
      billingPeriodStart,
    });

    // A different event (different idempotencyKey)
    await service.record({
      workspaceId,
      metric: "submission_accepted",
      quantity: 1,
      idempotencyKey: "submission:sub_002:submission_accepted",
      submissionOrigin: "live",
      billingPeriodStart,
    });

    const summary = await service.aggregatePeriod(workspaceId, billingPeriodStart);
    // Should be 2 (sub_001 + sub_002), not 3.
    expect(summary.totals["submission_accepted"]).toBe(2);
  });

  it("different metrics with same submission ID get separate keys and both record", async () => {
    await service.record({
      workspaceId,
      metric: "submission_accepted",
      quantity: 1,
      idempotencyKey: "submission:sub_001:submission_accepted",
      submissionOrigin: "live",
      billingPeriodStart,
    });
    await service.record({
      workspaceId,
      metric: "email_delivered",
      quantity: 1,
      idempotencyKey: "submission:sub_001:email_delivered",
      billingPeriodStart,
    });

    expect(db.eventCount).toBe(2);
    const summary = await service.aggregatePeriod(workspaceId, billingPeriodStart);
    expect(summary.totals["submission_accepted"]).toBe(1);
    expect(summary.totals["email_delivered"]).toBe(1);
  });

  it("rejects quantity <= 0", async () => {
    await expect(
      service.record({
        workspaceId,
        metric: "submission_accepted",
        quantity: 0,
        idempotencyKey: "bad:zero:quantity",
        submissionOrigin: "live",
        billingPeriodStart,
      }),
    ).rejects.toThrow("quantity must be > 0");
  });
});
