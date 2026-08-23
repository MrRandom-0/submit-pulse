/**
 * Failed-payment dunning state machine.
 *
 * This module models the lifecycle of a subscription after a payment fails:
 *   GRACE → RETRYING → DOWNGRADED → (RESOLVED | CANCELED)
 *
 * SPEC REQUIREMENT — ETHICAL CANCELLATION UX:
 *   The cancel path MUST be as discoverable as the upgrade path. This is a
 *   hard product requirement. Do not implement dark patterns such as:
 *     - Hiding the cancel button behind extra clicks when the upgrade is one click.
 *     - Using alarming language only on the cancel path.
 *     - Requiring a phone call or chat to cancel when upgrades are self-serve.
 *   The dunning flow may inform the user of consequences of cancellation but
 *   must not manipulate or obstruct their decision.
 *
 * Stripe handles payment retries according to the subscription's retry schedule.
 * This module tracks application-level state (grace period, downgrade) and
 * decides when to take actions like sending notifications or downgrading the plan.
 *
 * All timestamps are integers (Unix seconds or ms). No floating point.
 */

import type { PlanId } from "@submitpulse/config/entitlements";

/** Dunning state for a subscription. */
export type DunningState =
  /** Payment just failed; customer in a grace period. */
  | "grace"
  /** Stripe is retrying; customer still has access. */
  | "retrying"
  /** Grace period and retries exhausted; plan downgraded to free. */
  | "downgraded"
  /** Payment recovered; normal operation. */
  | "resolved"
  /** Customer explicitly cancelled (or subscription hard-cancelled by Stripe). */
  | "canceled";

/** Grace period before any action is taken after the first payment failure (ms). */
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/** Maximum calendar days of retrying before downgrading. */
const MAX_RETRY_DAYS = 14;

/** Plan to downgrade to on exhausted retries. */
const DOWNGRADE_PLAN: PlanId = "free";

export interface DunningRecord {
  readonly workspaceId: string;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
  readonly state: DunningState;
  readonly previousPlanId: PlanId;
  /** Unix timestamp (ms) of the first payment failure in this cycle. */
  readonly firstFailedAt: number;
  /** Unix timestamp (ms) of the most recent payment failure. */
  readonly lastFailedAt: number;
  /** Number of Stripe retry attempts so far. */
  readonly attemptCount: number;
  /** Unix timestamp (ms) of the next Stripe retry, or null if no more retries. */
  readonly nextRetryAt: number | null;
  /** Unix timestamp (ms) when a downgrade notification was sent, or null. */
  readonly notifiedDowngradeAt: number | null;
}

/** Actions the caller should take in response to a dunning event. */
export type DunningAction =
  | { readonly type: "send_payment_failed_email"; readonly attemptNumber: number }
  | { readonly type: "send_grace_period_warning"; readonly endsAt: number }
  | { readonly type: "send_final_warning" }
  | {
      readonly type: "downgrade_plan";
      readonly fromPlanId: PlanId;
      readonly toPlanId: PlanId;
    }
  | { readonly type: "send_downgrade_notification"; readonly toPlanId: PlanId }
  | { readonly type: "resolve_dunning" };

export interface InvoiceFailedEvent {
  readonly workspaceId: string;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
  readonly currentPlanId: PlanId;
  readonly attemptCount: number;
  /** Unix timestamp (ms) of the next Stripe retry, or null. */
  readonly nextRetryAt: number | null;
  /** Unix timestamp (ms) of this failure. */
  readonly failedAt: number;
}

export interface InvoicePaidEvent {
  readonly stripeSubscriptionId: string;
  /** Unix timestamp (ms) of the payment. */
  readonly paidAt: number;
}

/** DB adapter for dunning state persistence. */
export interface DunningDb {
  getRecord(stripeSubscriptionId: string): Promise<DunningRecord | null>;
  upsertRecord(record: DunningRecord): Promise<void>;
  /** Downgrade the workspace's subscription plan to the free tier. */
  downgradePlan(workspaceId: string, toPlanId: PlanId, fromPlanId: PlanId): Promise<void>;
  /** Clear the dunning record on resolution or cancellation. */
  deleteRecord(stripeSubscriptionId: string): Promise<void>;
}

export class DunningStateMachine {
  readonly #db: DunningDb;

  constructor(db: DunningDb) {
    this.#db = db;
  }

  /**
   * Process an invoice.payment_failed event.
   * Returns the list of actions the caller should enqueue.
   */
  async handlePaymentFailed(event: InvoiceFailedEvent): Promise<readonly DunningAction[]> {
    const now = event.failedAt;
    const existing = await this.#db.getRecord(event.stripeSubscriptionId);

    const firstFailedAt = existing?.firstFailedAt ?? now;
    const daysInDunning = (now - firstFailedAt) / (24 * 60 * 60 * 1000);
    const actions: DunningAction[] = [];

    // Determine new state.
    let newState: DunningState;
    if (daysInDunning <= 0) {
      newState = "grace";
    } else if (daysInDunning < MAX_RETRY_DAYS && event.nextRetryAt !== null) {
      newState = "retrying";
    } else {
      newState = "downgraded";
    }

    const record: DunningRecord = {
      workspaceId: event.workspaceId,
      stripeCustomerId: event.stripeCustomerId,
      stripeSubscriptionId: event.stripeSubscriptionId,
      state: newState,
      previousPlanId: existing?.previousPlanId ?? event.currentPlanId,
      firstFailedAt,
      lastFailedAt: now,
      attemptCount: event.attemptCount,
      nextRetryAt: event.nextRetryAt,
      notifiedDowngradeAt: existing?.notifiedDowngradeAt ?? null,
    };

    await this.#db.upsertRecord(record);

    // Always send a payment failed email for each attempt.
    actions.push({
      type: "send_payment_failed_email",
      attemptNumber: event.attemptCount,
    });

    if (newState === "grace") {
      actions.push({
        type: "send_grace_period_warning",
        endsAt: firstFailedAt + GRACE_PERIOD_MS,
      });
    }

    if (newState === "downgraded") {
      // Only downgrade once — check that we haven't already downgraded.
      if (existing?.state !== "downgraded") {
        actions.push({ type: "send_final_warning" });
        await this.#db.downgradePlan(
          event.workspaceId,
          DOWNGRADE_PLAN,
          event.currentPlanId,
        );
        actions.push({
          type: "downgrade_plan",
          fromPlanId: event.currentPlanId,
          toPlanId: DOWNGRADE_PLAN,
        });
        // Update record to set notifiedDowngradeAt.
        const updatedRecord: DunningRecord = { ...record, notifiedDowngradeAt: now };
        await this.#db.upsertRecord(updatedRecord);
        actions.push({
          type: "send_downgrade_notification",
          toPlanId: DOWNGRADE_PLAN,
        });
      }
    }

    return actions;
  }

  /**
   * Process an invoice.paid event (payment recovery).
   * Returns actions to notify the customer that their account is back to normal.
   */
  async handlePaymentRecovered(event: InvoicePaidEvent): Promise<readonly DunningAction[]> {
    const existing = await this.#db.getRecord(event.stripeSubscriptionId);
    if (!existing) {
      // No dunning record — this payment was not following a failure. No-op.
      return [];
    }

    await this.#db.deleteRecord(event.stripeSubscriptionId);
    return [{ type: "resolve_dunning" }];
  }
}
