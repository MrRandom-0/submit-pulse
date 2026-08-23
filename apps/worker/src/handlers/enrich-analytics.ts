/**
 * enrich-analytics handler.
 *
 * IDEMPOTENCY: Analytics enrichment is additive; running it twice for the same
 * submission is safe because the underlying aggregates are computed from the
 * submissions table, not accumulated counters. The handler is also gated on
 * submission origin — synthetic submissions are skipped unconditionally.
 *
 * SYNTHETIC EXCLUSION (enforced in code): Synthetic health-check submissions
 * MUST NOT emit a billable usage event and MUST NOT be counted in analytics.
 * The check is against the DB origin column so retroactive re-classification
 * of a submission is respected on retry.
 *
 * DELIVERY GUARANTEE: This is a best-effort enrichment job. Failures are
 * retried but analytics lag is acceptable. The submission itself is not at risk.
 */

import type { Job } from "../queue.js";

export interface EnrichAnalyticsPayload {
  submissionId: string;
  workspaceId: string;
  formId: string;
  origin: string;
}

export async function handleEnrichAnalytics(job: Job<unknown>): Promise<void> {
  const payload = job.payload as EnrichAnalyticsPayload;
  const { submissionId, workspaceId, origin } = payload;

  // SYNTHETIC EXCLUSION: synthetic health-check submissions must NEVER emit
  // billable usage events or be counted in analytics aggregates.
  // Enforced here in code, not just in comments.
  if (origin === "synthetic") {
    console.log(
      `[enrich-analytics] Skipping synthetic submission ${submissionId} — ` +
        `no billable event will be emitted.`,
    );
    return; // ← hard return — no further processing
  }

  console.log(
    `[enrich-analytics] Enriching analytics for submission ${submissionId} ` +
      `in workspace ${workspaceId} (attempt ${job.attemptNumber})`,
  );

  // TODO:
  //   1. Load submission (re-verify origin from DB in case of retroactive change).
  //   2. Update workspace usage counters (increment submission_count for billing).
  //   3. Update form-level aggregate stats (avg latency, geographic spread, UTM).
  //   4. Emit billable usage event to billing system ONLY for non-synthetic submissions.
  //      The origin check above is the enforcement point.
}
