/**
 * Stage 10 — Enqueue.
 *
 * Publish the accepted submission to the Cloudflare Queue for async processing.
 *
 * The queue consumer performs (NOT the hot path):
 *   - Email notifications and autoresponders
 *   - Webhook delivery to integrations
 *   - AI-powered spam scoring upgrade
 *   - File antivirus scanning
 *   - Drift detection comparison
 *   - Analytics counter increments
 *
 * If the queue send fails after a successful DB write, we still return 202 —
 * the submission is durably stored and an operator alert will fire so the job
 * can be re-queued. We NEVER silently lose an accepted submission.
 */

import type { SubmissionQueueMessage } from "../types.js";

export async function enqueueSubmission(
  queue: Queue<SubmissionQueueMessage>,
  message: SubmissionQueueMessage,
): Promise<void> {
  try {
    await queue.send(message);
  } catch (err) {
    // Log the error for operator alerting. The submission is already durably
    // persisted in the DB — it will be picked up by the reconciliation job.
    // Do NOT throw: a queue failure must not downgrade a 202 to a 503.
    console.error(
      "[enqueue] Failed to enqueue submission — will rely on reconciliation:",
      {
        submissionId: message.submissionId,
        formId: message.formId,
        error: err instanceof Error ? err.message : String(err),
      },
    );
  }
}
