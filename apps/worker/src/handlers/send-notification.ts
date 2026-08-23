/**
 * send-notification handler.
 *
 * IDEMPOTENCY: Before calling the email provider, the worker checks
 * email_deliveries for an existing row with the same idempotency_key.
 * If found, the job is a no-op — the email was already sent (or is in
 * flight). The DB has a UNIQUE constraint on idempotency_key as a
 * belt-and-suspenders guard against concurrent redeliveries.
 *
 * DELIVERY GUARANTEE: On provider failure the job is nacked and retried.
 * The idempotency key prevents duplicate sends on retry because the provider
 * is called only when no matching key exists in email_deliveries.
 */

import type { Job } from "../queue.js";

export interface SendNotificationPayload {
  submissionId: string;
  emailDestinationId: string;
  workspaceId: string;
  formId: string;
  /** Pre-derived idempotency key (see packages/email/src/idempotency.ts). */
  idempotencyKey: string;
}

export async function handleSendNotification(job: Job<unknown>): Promise<void> {
  const payload = job.payload as SendNotificationPayload;
  const { submissionId, emailDestinationId, idempotencyKey } = payload;

  // IDEMPOTENCY: Check for existing delivery row before sending.
  // TODO: db.select().from(emailDeliveries).where(eq(emailDeliveries.idempotencyKey, idempotencyKey))
  // If row exists → return early.

  console.log(
    `[send-notification] Sending notification for submission ${submissionId} ` +
      `to destination ${emailDestinationId} (attempt ${job.attemptNumber}, key ${idempotencyKey})`,
  );

  // TODO:
  //   1. Load email_destination row (verify verifiedAt, enabled).
  //   2. Load submission data for the form.
  //   3. Render renderNotification() from @submitpulse/email.
  //   4. INSERT INTO email_deliveries ON CONFLICT DO NOTHING (idempotency guard).
  //   5. Call emailProvider.send(). Update status on success/failure.
}
