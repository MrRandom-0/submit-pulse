/**
 * run-health-check handler.
 *
 * IDEMPOTENCY: Each health run has a unique health_runs row keyed by a
 * composite of (healthMonitorId, startedAt). The handler inserts the row with
 * ON CONFLICT DO NOTHING at the start. If the run was already started by a
 * duplicate job delivery, the insert is a no-op and the handler exits early.
 *
 * SYNTHETIC EXCLUSION: Health-check submissions created by this handler have
 * origin='synthetic'. All downstream analytics, autoresponders, webhooks, and
 * billing metering must exclude them. Enforcement is at those sites.
 *
 * DELIVERY GUARANTEE: On failure the job is nacked. The health_runs row is
 * updated to status='error' after max attempts so monitors are not stuck
 * in an unknown state indefinitely.
 */

import type { Job } from "../queue.js";

export interface RunHealthCheckPayload {
  healthMonitorId: string;
  workspaceId: string;
  formId: string;
  targetUrl: string;
  /** ISO timestamp when this run was scheduled. Used as the idempotency anchor. */
  scheduledAt: string;
}

export async function handleRunHealthCheck(job: Job<unknown>): Promise<void> {
  const payload = job.payload as RunHealthCheckPayload;
  const { healthMonitorId, targetUrl, scheduledAt } = payload;

  // IDEMPOTENCY: INSERT health_runs ON CONFLICT DO NOTHING keyed on
  // (health_monitor_id, started_at). Exits early if already running.
  // TODO: db.insert(healthRuns).values({ healthMonitorId, ... }).onConflictDoNothing()

  console.log(
    `[run-health-check] Running health check for monitor ${healthMonitorId} ` +
      `targetUrl=${targetUrl} scheduledAt=${scheduledAt} (attempt ${job.attemptNumber})`,
  );

  // TODO:
  //   1. Assert SSRF safety on targetUrl via assertSafeEgressUrl.
  //   2. Load the target page, locate the form, submit synthetic data.
  //   3. Record each step in health_runs.steps.
  //   4. On success: UPDATE health_monitors SET currentStatus='healthy',
  //      consecutiveFailures=0, lastSuccessAt=now.
  //   5. On failure: INCREMENT consecutiveFailures, potentially open incident.
  //   6. SYNTHETIC SUBMISSION: any submission created here MUST have origin='synthetic'
  //      so it is excluded from analytics, autoresponders, webhooks, and billing.
}
