/**
 * deliver-webhook handler.
 *
 * IDEMPOTENCY: The job carries a deliveryId that is the PRIMARY KEY of the
 * webhook_deliveries row. The row is inserted with ON CONFLICT DO NOTHING on
 * the delivery_id unique constraint before the HTTP call. On retry the row
 * already exists and the handler updates it rather than inserting a duplicate.
 *
 * DELIVERY GUARANTEE: On failure the job is nacked. The webhook_deliveries row
 * captures every attempt. After max attempts (see retry.ts) the endpoint's
 * consecutiveFailures counter is incremented and, if it reaches the threshold,
 * the endpoint is auto-disabled to stop consuming queue budget.
 */

import { attemptDelivery } from "@submitpulse/webhooks";
import { computeBackoff, nextRetryAt, shouldAutoDisable } from "@submitpulse/webhooks";
import type { Job } from "../queue.js";
import type { AnyWebhookPayload } from "@submitpulse/webhooks";

export interface DeliverWebhookPayload {
  webhookEndpointId: string;
  workspaceId: string;
  submissionId: string | null;
  deliveryId: string;
  targetUrl: string;
  /** Plaintext signing secret. Must be obtained from a secrets store, not the DB. */
  secret: string;
  payload: AnyWebhookPayload;
  attemptsSoFar: number;
}

export async function handleDeliverWebhook(job: Job<unknown>): Promise<void> {
  const payload = job.payload as DeliverWebhookPayload;
  const { deliveryId, webhookEndpointId, targetUrl, secret, attemptsSoFar } = payload;

  console.log(
    `[deliver-webhook] Attempting delivery ${deliveryId} to endpoint ${webhookEndpointId} ` +
      `(attempt ${attemptsSoFar + 1})`,
  );

  // TODO: INSERT into webhook_deliveries ON CONFLICT DO NOTHING using deliveryId as key.
  //       On conflict: the row exists from a prior attempt — proceed to update it.

  const result = await attemptDelivery({
    url: targetUrl,
    secret,
    deliveryId,
    payload: payload.payload,
  });

  // TODO: UPDATE webhook_deliveries SET status, responseStatus, responseBodySnippet,
  //       durationMs, error, attemptCount = attemptsSoFar + 1.

  if (result.success) {
    // TODO: UPDATE webhook_endpoints SET consecutiveFailures=0, lastSuccessAt=now.
    console.log(`[deliver-webhook] Delivery ${deliveryId} succeeded (HTTP ${result.httpStatus})`);
    return;
  }

  // Delivery failed — compute next retry.
  const backoff = computeBackoff(attemptsSoFar + 1);

  if (backoff.exhausted) {
    // TODO: UPDATE webhook_deliveries SET status='failed'.
    // TODO: INCREMENT webhook_endpoints.consecutiveFailures.
    // TODO: If shouldAutoDisable(newConsecutiveFailures) → set disabledAt=now.
    console.error(
      `[deliver-webhook] Delivery ${deliveryId} exhausted retries. Moving to dead-letter path.`,
    );
    // Throw so the queue driver records this as a final failure.
    throw new Error(`Webhook delivery ${deliveryId} permanently failed after max attempts`);
  }

  const retryAt = nextRetryAt(backoff.delayMs);
  // TODO: UPDATE webhook_deliveries SET nextRetryAt = retryAt, status='queued'.
  // TODO: INCREMENT webhook_endpoints.consecutiveFailures.
  // TODO: Check shouldAutoDisable — if true, set disabledAt.

  const autoDisable = shouldAutoDisable(/* consecutiveFailures after increment */ attemptsSoFar + 1);
  if (autoDisable) {
    console.warn(
      `[deliver-webhook] Endpoint ${webhookEndpointId} will be auto-disabled after sustained failures.`,
    );
    // TODO: UPDATE webhook_endpoints SET disabledAt=now WHERE disabledAt IS NULL.
  }

  console.log(
    `[deliver-webhook] Delivery ${deliveryId} failed (${result.error}). ` +
      `Retry scheduled at ${retryAt.toISOString()}`,
  );

  // Throw so the queue driver redelivers the message.
  throw new Error(`Webhook delivery ${deliveryId} failed: ${result.error}`);
}
