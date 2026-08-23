/**
 * sweep-retention handler.
 *
 * Periodically hard-deletes submissions and files that have passed their
 * purge_after date (set by the retention policy at soft-delete time).
 *
 * IDEMPOTENCY: DELETE WHERE purge_after < now AND deleted_at IS NOT NULL is
 * inherently idempotent — deleting already-deleted rows is a no-op.
 *
 * DELIVERY GUARANTEE: Retention sweep failures are non-critical; data will be
 * swept on the next scheduled run. The sweep is scoped to small batches to
 * avoid long-running transactions and to make partial progress durable.
 */

import type { Job } from "../queue.js";

export interface SweepRetentionPayload {
  /** ISO timestamp — sweep rows whose purge_after is before this time. */
  sweepBefore: string;
  /** Maximum rows to delete in this invocation (pagination guard). */
  batchSize: number;
}

export async function handleSweepRetention(job: Job<unknown>): Promise<void> {
  const payload = job.payload as SweepRetentionPayload;
  const { sweepBefore, batchSize } = payload;

  console.log(
    `[sweep-retention] Sweeping rows with purge_after < ${sweepBefore} ` +
      `batchSize=${batchSize} (attempt ${job.attemptNumber})`,
  );

  // IDEMPOTENCY: DELETE is idempotent — rows already deleted are not re-deleted.
  // TODO:
  //   1. DELETE FROM submission_files WHERE purge_after < sweepBefore
  //      AND deleted_at IS NOT NULL LIMIT batchSize (hard-delete files first).
  //   2. DELETE FROM submissions WHERE purge_after < sweepBefore
  //      AND deleted_at IS NOT NULL LIMIT batchSize.
  //   3. If rows deleted === batchSize, re-enqueue another sweep job to continue
  //      (the batch was full, more rows may remain).
}
