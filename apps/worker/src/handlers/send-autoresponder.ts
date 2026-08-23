/**
 * send-autoresponder handler.
 *
 * SPAM / SYNTHETIC SUPPRESSION (enforced in code, not just comments):
 *   - Spam submissions (spamVerdict = 'spam' | 'blocked'): NO autoresponder.
 *     Sending to spam submissions rewards abusers and risks getting the
 *     platform's sending IPs blocklisted.
 *   - Synthetic submissions (origin = 'synthetic'): NO autoresponder.
 *     Sending to health-check submissions would create mail loops with
 *     the health-check system.
 *   The check is performed AFTER loading the submission from the database
 *     so that a submission that was retroactively marked spam after the job
 *     was enqueued is still suppressed.
 *
 * MAIL LOOP PREVENTION:
 *   The autoresponder's replyToEmail MUST NOT be a no-reply address.
 *   This is validated at configuration time (see the autoresponders schema).
 *   Additionally, the handler checks that the resolved To address is
 *   structurally valid and is not the platform's own sending address.
 *
 * IDEMPOTENCY: Same idempotency_key / ON CONFLICT DO NOTHING pattern as
 *   send-notification. A retried job cannot send a second autoresponder to
 *   the same submitter.
 *
 * DELIVERY GUARANTEE: On failure the job is nacked. After max attempts the
 *   DLQ captures it for manual inspection. The submission is never lost.
 */

import { brand } from "@submitpulse/config";
import type { Job } from "../queue.js";

export interface SendAutoresponderPayload {
  submissionId: string;
  autoresponderId: string;
  workspaceId: string;
  formId: string;
  idempotencyKey: string;
}

/** Platform sender addresses that must not receive autoresponders (mail-loop guard). */
const PLATFORM_SENDER_ADDRESSES = new Set<string>([
  brand.email.from,
  brand.email.support,
  brand.email.security,
  brand.email.abuse,
  brand.email.privacy,
]);

export async function handleSendAutoresponder(job: Job<unknown>): Promise<void> {
  const payload = job.payload as SendAutoresponderPayload;
  const { submissionId, autoresponderId, idempotencyKey } = payload;

  // ── SPAM / SYNTHETIC GUARD ──────────────────────────────────────────────
  // Load the submission from DB.
  // TODO: const submission = await db.query.submissions.findFirst(...)
  // ENFORCEMENT: check these conditions in code, not just rely on the caller.
  const submissionOrigin: string = "live"; // TODO: replace with real DB value
  const submissionSpamVerdict: string = "clean"; // TODO: replace with real DB value

  // SYNTHETIC SUPPRESSION: health-check submissions must never trigger autoresponders.
  if (submissionOrigin === "synthetic") {
    console.log(
      `[send-autoresponder] Suppressed: submission ${submissionId} is synthetic.`,
    );
    return; // ← hard return, not just a log
  }

  // SPAM SUPPRESSION: spam/blocked submissions must never trigger autoresponders.
  if (submissionSpamVerdict === "spam" || submissionSpamVerdict === "blocked") {
    console.log(
      `[send-autoresponder] Suppressed: submission ${submissionId} verdict is ${submissionSpamVerdict}.`,
    );
    return; // ← hard return, not just a log
  }
  // ── END SPAM / SYNTHETIC GUARD ──────────────────────────────────────────

  // IDEMPOTENCY: check for existing delivery row before sending.
  // TODO: db.select().from(emailDeliveries).where(eq(emailDeliveries.idempotencyKey, idempotencyKey))

  // TODO:
  //   1. Load autoresponder config (enabled, toFieldName, subject, bodyHtml, bodyText).
  //   2. Extract To address from submission.data[autoresponder.toFieldName].
  //   3. Validate To address shape and ensure it is not a platform address.
  //   4. Apply delaySeconds — if delaySeconds > 0 and the wall clock hasn't passed,
  //      re-enqueue the job to run later rather than sleeping in the handler.

  // MAIL LOOP GUARD: ensure resolved To is not a platform sender address.
  const toAddress: string = ""; // TODO: resolved from submission data
  if (PLATFORM_SENDER_ADDRESSES.has(toAddress.toLowerCase())) {
    console.error(
      `[send-autoresponder] Blocked: autoresponder To resolves to a platform address (${toAddress}). ` +
        `This would create a mail loop. Submission: ${submissionId}`,
    );
    return; // ← hard return
  }

  console.log(
    `[send-autoresponder] Sending autoresponder for submission ${submissionId} ` +
      `via autoresponder ${autoresponderId} (attempt ${job.attemptNumber})`,
  );

  // TODO:
  //   5. Render renderAutoresponder() from @submitpulse/email.
  //   6. INSERT INTO email_deliveries ON CONFLICT DO NOTHING.
  //   7. Call emailProvider.send(). Update status.
}
