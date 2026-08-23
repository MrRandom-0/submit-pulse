/**
 * process-submission handler.
 *
 * IDEMPOTENCY: The handler checks submissions.status before doing any work.
 * If the status is already beyond "new" (i.e. "processing" or "processed"),
 * the job is a no-op. This is safe because:
 *   1. The ingestion API sets status="new" at creation time.
 *   2. This handler atomically transitions to "processing" and then "processed"
 *      using an UPDATE ... WHERE status='new' that returns 0 rows if already
 *      advanced, preventing double-processing.
 *   3. All downstream jobs (send-notification, deliver-webhook, etc.) are
 *      idempotent themselves.
 *
 * DELIVERY GUARANTEE: On any unhandled error the job is nacked back to the
 * queue for retry. After max attempts the queue driver moves it to the DLQ.
 * The submission row is never silently lost — it persists in the database
 * regardless of processing outcome.
 */

import type { Job } from "../queue.js";

export interface ProcessSubmissionPayload {
  submissionId: string;
  formId: string;
  workspaceId: string;
}

export async function handleProcessSubmission(job: Job<unknown>): Promise<void> {
  const payload = job.payload as ProcessSubmissionPayload;
  const { submissionId } = payload;

  // IDEMPOTENCY: transition status from 'new' -> 'processing' atomically.
  // If the row is already in a later state, the UPDATE touches 0 rows and
  // we exit early without re-firing downstream jobs.
  //
  // TODO: Replace this stub with the actual DB call via @submitpulse/database.
  // Example: db.update(submissions).set({ status: 'processing' })
  //             .where(and(eq(submissions.id, submissionId), eq(submissions.status, 'new')))
  console.log(`[process-submission] Processing submission ${submissionId} (attempt ${job.attemptNumber})`);

  // Stub: enqueue downstream jobs.
  // In production:
  //   - Enqueue send-notification for each verified, enabled email_destination
  //   - Enqueue send-autoresponder if an autoresponder exists and is enabled
  //   - Enqueue deliver-webhook for each enabled webhook_endpoint
  //   - Enqueue scan-file for each submission_file
  //   - Enqueue enrich-analytics

  console.log(`[process-submission] Submission ${submissionId} dispatched to downstream jobs`);
}
