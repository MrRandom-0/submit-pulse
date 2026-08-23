/**
 * Worker entry point.
 *
 * Routes jobs to their handlers. Each handler is imported as a separate module
 * so the job router has a single, auditable dispatch table.
 *
 * DELIVERY GUARANTEE:
 * Jobs that throw are nacked by the queue driver and re-enqueued for retry
 * with backoff (see packages/webhooks/src/retry.ts for backoff maths).
 * After max attempts the driver moves the job to the dead-letter queue (DLQ).
 * An accepted submission is NEVER silently discarded — it always lands in the
 * DB before this worker sees it, and the DLQ captures any jobs that cannot be
 * processed successfully after all retries.
 *
 * IDEMPOTENCY:
 * Every handler is idempotent — see each handler's module comment for
 * the specific mechanism. This is the contract that makes at-least-once
 * delivery safe.
 */

import type { Job, JobType } from "./queue.js";
import { handleProcessSubmission } from "./handlers/process-submission.js";
import { handleSendNotification } from "./handlers/send-notification.js";
import { handleSendAutoresponder } from "./handlers/send-autoresponder.js";
import { handleDeliverWebhook } from "./handlers/deliver-webhook.js";
import { handleScanFile } from "./handlers/scan-file.js";
import { handleRunHealthCheck } from "./handlers/run-health-check.js";
import { handleEnrichAnalytics } from "./handlers/enrich-analytics.js";
import { handleSweepRetention } from "./handlers/sweep-retention.js";

type HandlerFn = (job: Job<unknown>) => Promise<void>;

const HANDLERS: Record<JobType, HandlerFn> = {
  "process-submission": handleProcessSubmission,
  "send-notification": handleSendNotification,
  "send-autoresponder": handleSendAutoresponder,
  "deliver-webhook": handleDeliverWebhook,
  "scan-file": handleScanFile,
  "run-health-check": handleRunHealthCheck,
  "enrich-analytics": handleEnrichAnalytics,
  "sweep-retention": handleSweepRetention,
};

/**
 * Dispatch a single job to its handler.
 *
 * Throws on handler failure so the queue driver can nack and retry the message.
 * Unexpected job types are logged and ACKed (not re-queued) to avoid poison-pill
 * loops — an unrecognised type cannot be handled by any retry.
 */
export async function dispatch(job: Job<unknown>): Promise<void> {
  const handler = HANDLERS[job.type as JobType];

  if (!handler) {
    // Unknown job types are logged but NOT thrown — throwing would cause
    // infinite retries of a job that can never succeed.
    console.error(
      `[worker] Unknown job type "${job.type}" (id=${job.id}). Acknowledging to avoid DLQ loop.`,
    );
    return;
  }

  try {
    await handler(job);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[worker] Handler for "${job.type}" failed (id=${job.id}, attempt=${job.attemptNumber}): ${message}`,
    );
    // Re-throw so the queue driver can nack and retry.
    throw err;
  }
}

export type { Job, JobType };
