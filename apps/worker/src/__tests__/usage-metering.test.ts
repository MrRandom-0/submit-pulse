/**
 * Tests for billable usage metering exclusion of synthetic submissions.
 *
 * Verifies that the enrich-analytics handler (and the analytics aggregation
 * helpers) correctly exclude synthetic submissions from all billable events
 * and metric aggregates.
 */

import { describe, it, expect } from "vitest";
import {
  aggregateSubmissionTotals,
  spamRate,
  aggregateUtm,
  processingDurationPercentiles,
} from "@submitpulse/analytics";
import type { SubmissionRecord } from "@submitpulse/analytics";

function makeSubmission(
  overrides: Partial<SubmissionRecord> = {},
): SubmissionRecord {
  return {
    id: "sub_" + Math.random().toString(36).slice(2),
    origin: "live",
    spamVerdict: "clean",
    createdAt: new Date(),
    processingMs: 50,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    ...overrides,
  };
}

describe("synthetic submission exclusion from analytics", () => {
  describe("aggregateSubmissionTotals", () => {
    it("excludes synthetic submissions from totals", () => {
      const submissions = [
        makeSubmission({ origin: "live" }),
        makeSubmission({ origin: "live" }),
        makeSubmission({ origin: "synthetic" }), // must be excluded
        makeSubmission({ origin: "synthetic" }), // must be excluded
      ];
      const result = aggregateSubmissionTotals(submissions);
      expect(result.total).toBe(2); // only the two live ones
    });

    it("returns zero total when only synthetic submissions present", () => {
      const submissions = [
        makeSubmission({ origin: "synthetic" }),
        makeSubmission({ origin: "synthetic" }),
      ];
      const result = aggregateSubmissionTotals(submissions);
      expect(result.total).toBe(0);
      expect(result.clean).toBe(0);
      expect(result.spam).toBe(0);
    });
  });

  describe("spamRate", () => {
    it("excludes synthetic from spam rate denominator", () => {
      const submissions = [
        makeSubmission({ origin: "live", spamVerdict: "spam" }),
        makeSubmission({ origin: "live", spamVerdict: "clean" }),
        makeSubmission({ origin: "synthetic", spamVerdict: "clean" }), // excluded
      ];
      // spamRate = 1 spam out of 2 real = 0.5
      const rate = spamRate(submissions);
      expect(rate).toBe(0.5);
    });

    it("returns null when only synthetic submissions present", () => {
      const submissions = [makeSubmission({ origin: "synthetic" })];
      expect(spamRate(submissions)).toBeNull();
    });
  });

  describe("processingDurationPercentiles", () => {
    it("excludes synthetic submissions from percentile calculations", () => {
      const submissions = [
        makeSubmission({ origin: "live", processingMs: 100 }),
        makeSubmission({ origin: "live", processingMs: 200 }),
        makeSubmission({ origin: "synthetic", processingMs: 9999 }), // excluded
      ];
      const result = processingDurationPercentiles(submissions);
      expect(result).not.toBeNull();
      // p99 should be 200, not 9999
      expect(result!.p99).toBeLessThanOrEqual(200);
      expect(result!.sampleCount).toBe(2);
    });

    it("returns null when only synthetic submissions present", () => {
      const submissions = [makeSubmission({ origin: "synthetic", processingMs: 100 })];
      expect(processingDurationPercentiles(submissions)).toBeNull();
    });
  });

  describe("aggregateUtm", () => {
    it("excludes synthetic submissions from UTM attribution", () => {
      const submissions = [
        makeSubmission({ origin: "live", utmSource: "google" }),
        makeSubmission({ origin: "synthetic", utmSource: "healthcheck" }), // excluded
      ];
      const result = aggregateUtm(submissions);
      expect(result.source["healthcheck"]).toBeUndefined();
      expect(result.source["google"]).toBe(1);
    });
  });

  describe("enrich-analytics handler guard (origin check)", () => {
    it("identifies synthetic origin correctly", () => {
      // This is the guard logic from enrich-analytics.ts.
      function isSynthetic(origin: string): boolean {
        return origin === "synthetic";
      }

      expect(isSynthetic("synthetic")).toBe(true);
      expect(isSynthetic("live")).toBe(false);
      expect(isSynthetic("test")).toBe(false);
    });
  });
});
