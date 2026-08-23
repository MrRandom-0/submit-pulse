/**
 * Analytics aggregation helpers.
 *
 * SYNTHETIC EXCLUSION CONTRACT (enforced at every aggregate boundary):
 * All functions in this module MUST exclude submissions with origin='synthetic'.
 * Synthetic health-check submissions are Pulse's own monitoring traffic; billing
 * the customer for them and including them in metrics would be incorrect.
 * The exclusion is enforced by the `excludeSynthetic` filter applied at the
 * start of every aggregate function. Never remove this filter.
 *
 * These are pure functions over typed inputs — no database calls. They operate
 * on pre-fetched arrays so they are trivially testable without a DB fixture.
 */

/* -------------------------------------------------------------------------- */
/* Input types                                                                 */
/* -------------------------------------------------------------------------- */

export type SubmissionOrigin = "live" | "test" | "synthetic";
export type SpamVerdict = "clean" | "spam" | "blocked" | "reviewed";

export interface SubmissionRecord {
  id: string;
  origin: SubmissionOrigin;
  spamVerdict: SpamVerdict;
  createdAt: Date;
  /** Wall-clock ms spent in the synchronous ingestion path. */
  processingMs: number | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
}

export interface EmailDeliveryRecord {
  id: string;
  status: "queued" | "sent" | "delivered" | "failed";
  createdAt: Date;
}

export interface WebhookDeliveryRecord {
  id: string;
  status: "queued" | "sent" | "delivered" | "failed";
  createdAt: Date;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * SYNTHETIC EXCLUSION: Filter out health-check submissions.
 * Called at the start of every aggregate — never skip this step.
 */
function excludeSynthetic(submissions: readonly SubmissionRecord[]): SubmissionRecord[] {
  // INVARIANT: synthetic health-check submissions must be excluded from every
  // aggregate. Billing or reporting on monitoring traffic is a trust violation.
  return submissions.filter((s) => s.origin !== "synthetic");
}

/* -------------------------------------------------------------------------- */
/* Submission aggregates                                                       */
/* -------------------------------------------------------------------------- */

export interface SubmissionTotals {
  total: number;
  spam: number;
  clean: number;
  /** Submissions whose spam verdict was human-reviewed. */
  reviewed: number;
}

/**
 * Count submission totals, excluding synthetic submissions.
 */
export function aggregateSubmissionTotals(
  submissions: readonly SubmissionRecord[],
): SubmissionTotals {
  // SYNTHETIC EXCLUSION enforced here.
  const real = excludeSynthetic(submissions);
  let spam = 0;
  let clean = 0;
  let reviewed = 0;
  for (const s of real) {
    if (s.spamVerdict === "spam" || s.spamVerdict === "blocked") spam++;
    else if (s.spamVerdict === "reviewed") reviewed++;
    else clean++;
  }
  return { total: real.length, spam, clean, reviewed };
}

/**
 * Compute spam rate as a fraction [0, 1] of total non-synthetic submissions.
 * Returns null when there are no submissions to avoid division by zero.
 */
export function spamRate(submissions: readonly SubmissionRecord[]): number | null {
  // SYNTHETIC EXCLUSION enforced here.
  const real = excludeSynthetic(submissions);
  if (real.length === 0) return null;
  const spam = real.filter(
    (s) => s.spamVerdict === "spam" || s.spamVerdict === "blocked",
  ).length;
  return spam / real.length;
}

/* -------------------------------------------------------------------------- */
/* UTM attribution                                                             */
/* -------------------------------------------------------------------------- */

export interface UtmBreakdown {
  source: Record<string, number>;
  medium: Record<string, number>;
  campaign: Record<string, number>;
  term: Record<string, number>;
  content: Record<string, number>;
}

/**
 * Aggregate UTM attribution counts from non-synthetic, non-spam submissions.
 */
export function aggregateUtm(submissions: readonly SubmissionRecord[]): UtmBreakdown {
  // SYNTHETIC EXCLUSION enforced here.
  const real = excludeSynthetic(submissions).filter(
    (s) => s.spamVerdict !== "spam" && s.spamVerdict !== "blocked",
  );

  const out: UtmBreakdown = {
    source: {},
    medium: {},
    campaign: {},
    term: {},
    content: {},
  };

  function count(bucket: Record<string, number>, value: string | null): void {
    if (!value) return;
    bucket[value] = (bucket[value] ?? 0) + 1;
  }

  for (const s of real) {
    count(out.source, s.utmSource);
    count(out.medium, s.utmMedium);
    count(out.campaign, s.utmCampaign);
    count(out.term, s.utmTerm);
    count(out.content, s.utmContent);
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Processing duration percentiles                                             */
/* -------------------------------------------------------------------------- */

export interface DurationPercentiles {
  p50: number;
  p95: number;
  p99: number;
  /** Number of submissions with a non-null processingMs value. */
  sampleCount: number;
}

/**
 * Compute p50/p95/p99 processing durations over non-synthetic submissions.
 * Submissions with null processingMs are excluded from the sample.
 * Returns null when there are no samples.
 */
export function processingDurationPercentiles(
  submissions: readonly SubmissionRecord[],
): DurationPercentiles | null {
  // SYNTHETIC EXCLUSION enforced here.
  const samples = excludeSynthetic(submissions)
    .map((s) => s.processingMs)
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => a - b);

  if (samples.length === 0) return null;

  function percentile(sorted: number[], p: number): number {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    const clamped = Math.max(0, Math.min(sorted.length - 1, idx));
    return sorted[clamped] ?? 0;
  }

  return {
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    sampleCount: samples.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Email delivery rate                                                         */
/* -------------------------------------------------------------------------- */

export interface DeliveryRate {
  /** Fraction [0, 1] of deliveries with status 'delivered'. */
  successRate: number | null;
  total: number;
  delivered: number;
  failed: number;
}

export function emailDeliveryRate(deliveries: readonly EmailDeliveryRecord[]): DeliveryRate {
  if (deliveries.length === 0) {
    return { successRate: null, total: 0, delivered: 0, failed: 0 };
  }
  let delivered = 0;
  let failed = 0;
  for (const d of deliveries) {
    if (d.status === "delivered") delivered++;
    else if (d.status === "failed") failed++;
  }
  return {
    successRate: delivered / deliveries.length,
    total: deliveries.length,
    delivered,
    failed,
  };
}

/* -------------------------------------------------------------------------- */
/* Webhook delivery rate                                                       */
/* -------------------------------------------------------------------------- */

export function webhookDeliveryRate(
  deliveries: readonly WebhookDeliveryRecord[],
): DeliveryRate {
  if (deliveries.length === 0) {
    return { successRate: null, total: 0, delivered: 0, failed: 0 };
  }
  let delivered = 0;
  let failed = 0;
  for (const d of deliveries) {
    if (d.status === "delivered") delivered++;
    else if (d.status === "failed") failed++;
  }
  return {
    successRate: delivered / deliveries.length,
    total: deliveries.length,
    delivered,
    failed,
  };
}
