/**
 * BillingProvider — interface every billing driver implements.
 *
 * Money amounts are always integer cents (USD). Never use floating point for
 * monetary values. Callers and implementations both enforce this.
 */

import type { PlanId } from "@submitpulse/config/entitlements";

/** Stripe price ID or internal plan price reference. */
export type PriceId = string;

/** Billing interval for a subscription. */
export type BillingInterval = "month" | "year";

/** Subscription status mirroring Stripe's set. */
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export interface SubscriptionInfo {
  readonly id: string;
  readonly status: SubscriptionStatus;
  readonly planId: PlanId;
  readonly priceId: PriceId;
  readonly billingInterval: BillingInterval;
  /** Unix timestamp (seconds). */
  readonly currentPeriodStart: number;
  /** Unix timestamp (seconds). */
  readonly currentPeriodEnd: number;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt: number | null;
  readonly trialEndsAt: number | null;
  readonly seats: number;
}

export interface InvoiceInfo {
  readonly id: string;
  /** Invoice number shown to customer (e.g. "INV-0001"). */
  readonly number: string | null;
  readonly status: "draft" | "open" | "paid" | "uncollectible" | "void";
  /** Total amount in cents. */
  readonly amountDueCents: number;
  /** Amount paid in cents. */
  readonly amountPaidCents: number;
  readonly currency: "usd";
  /** Unix timestamp (seconds). */
  readonly periodStart: number;
  /** Unix timestamp (seconds). */
  readonly periodEnd: number;
  readonly hostedInvoiceUrl: string | null;
  readonly invoicePdf: string | null;
  readonly createdAt: number;
}

export interface CreateCheckoutSessionParams {
  readonly workspaceId: string;
  readonly planId: PlanId;
  readonly priceId: PriceId;
  readonly billingInterval: BillingInterval;
  /** Pre-fill the customer email. */
  readonly customerEmail?: string;
  /** Stripe customer ID if one already exists for this workspace. */
  readonly stripeCustomerId?: string;
  /** URL to redirect to on successful checkout. */
  readonly successUrl: string;
  /** URL to redirect to on cancelled checkout. */
  readonly cancelUrl: string;
}

export interface CreateCheckoutSessionResult {
  readonly sessionId: string;
  readonly url: string;
}

export interface CreatePortalSessionParams {
  readonly stripeCustomerId: string;
  /** URL to return to after the customer exits the portal. */
  readonly returnUrl: string;
}

export interface CreatePortalSessionResult {
  readonly url: string;
}

export interface UpdatePlanParams {
  readonly stripeSubscriptionId: string;
  readonly newPriceId: PriceId;
  /** If true, apply the change at end of billing period; otherwise immediately. */
  readonly prorationBehavior: "create_prorations" | "none" | "always_invoice";
}

/**
 * Every billing driver implements this interface.
 *
 * The driver is responsible for talking to the payment processor. The
 * application layer must not call Stripe directly — all calls go through this
 * interface so the dev driver can substitute without network access.
 */
export interface BillingProvider {
  /**
   * Create a Stripe Checkout session. Returns a URL to redirect the user to.
   * Amounts are determined by the priceId, not passed here — never accept
   * amount parameters from the client.
   */
  createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<CreateCheckoutSessionResult>;

  /**
   * Create a Stripe Customer Portal session. The portal lets customers manage
   * their payment methods, invoices, and cancellations without going through
   * the app UI.
   *
   * SPEC REQUIREMENT: the cancel path in the portal must be as discoverable as
   * the upgrade path. Do not hide or suppress portal features that allow
   * cancellation.
   */
  createPortalSession(params: CreatePortalSessionParams): Promise<CreatePortalSessionResult>;

  /** Fetch the current subscription state for a Stripe subscription ID. */
  getSubscription(stripeSubscriptionId: string): Promise<SubscriptionInfo>;

  /**
   * Mark the subscription to cancel at the end of the current billing period.
   * Does NOT immediately cancel — the customer retains access until period end.
   */
  cancelSubscription(stripeSubscriptionId: string): Promise<SubscriptionInfo>;

  /**
   * Undo a pending cancellation (cancel_at_period_end = false).
   * Only valid if the subscription has not yet expired.
   */
  reactivateSubscription(stripeSubscriptionId: string): Promise<SubscriptionInfo>;

  /** Change the subscription to a different price (plan or interval change). */
  updatePlan(params: UpdatePlanParams): Promise<SubscriptionInfo>;

  /** List recent invoices for a Stripe customer. */
  listInvoices(stripeCustomerId: string, limit?: number): Promise<readonly InvoiceInfo[]>;
}

/** Thrown when the billing provider is misconfigured. */
export class BillingConfigError extends Error {
  constructor(message: string, public readonly driver: string) {
    super(message);
    this.name = "BillingConfigError";
  }
}

/** Thrown on permanent API failures (not transient). */
export class BillingApiError extends Error {
  constructor(
    message: string,
    public readonly driver: string,
    public readonly statusCode?: number,
    public readonly stripeCode?: string,
  ) {
    super(message);
    this.name = "BillingApiError";
  }
}
