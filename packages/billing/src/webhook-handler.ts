/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Stripe webhook event processor.
 *
 * CRITICAL — SIGNATURE VERIFICATION:
 *   Stripe signs every webhook request with a secret (whsec_…). The signature
 *   MUST be verified before acting on any payload. Skipping verification allows
 *   an attacker to forge billing events (e.g. fake subscription upgrades).
 *
 *   Verification uses the raw, unmodified request body bytes. Parsing the body
 *   as JSON first breaks verification because serialisation is not guaranteed
 *   to be canonical. Always pass the raw Buffer / Uint8Array to verifySignature.
 *
 * IDEMPOTENCY:
 *   Stripe may deliver the same event more than once (at-least-once delivery).
 *   Every handler checks whether the event has already been processed using the
 *   Stripe event id as the idempotency key. Writes to the database use
 *   ON CONFLICT DO NOTHING (or equivalent) on that key.
 *
 * SOURCE OF TRUTH:
 *   Stripe is the authoritative source for subscription status. Never update
 *   subscription state from the app UI alone — always reconcile against the
 *   Stripe event. The local `subscriptions` table is a projection of Stripe
 *   state, kept in sync by these handlers.
 *
 * Required environment variable (named via brand.env.var()):
 *   SP_STRIPE_WEBHOOK_SECRET : Stripe webhook signing secret (whsec_…)
 */

import { brand } from "@submitpulse/config/brand";
import type { PlanId } from "@submitpulse/config/entitlements";
import { BillingConfigError } from "./provider";

/** Minimal database adapter interface. The caller provides a real implementation. */
export interface WebhookDb {
  /** Returns true if this Stripe event id has already been processed. */
  hasProcessedEvent(stripeEventId: string): Promise<boolean>;
  /** Mark the event as processed. Called after all side-effects are committed. */
  markEventProcessed(stripeEventId: string): Promise<void>;
  /** Upsert subscription row from Stripe data. */
  upsertSubscription(data: SubscriptionUpsert): Promise<void>;
  /** Record a successful invoice payment. */
  recordInvoicePaid(data: InvoicePaid): Promise<void>;
  /** Record a failed invoice payment. */
  recordInvoicePaymentFailed(data: InvoicePaymentFailed): Promise<void>;
}

export interface SubscriptionUpsert {
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
  readonly stripePriceId: string;
  readonly planId: PlanId;
  readonly status: string;
  readonly billingInterval: "month" | "year";
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt: Date | null;
  readonly trialEndsAt: Date | null;
  readonly seats: number;
}

export interface InvoicePaid {
  readonly stripeCustomerId: string;
  readonly stripeInvoiceId: string;
  readonly amountPaidCents: number;
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

export interface InvoicePaymentFailed {
  readonly stripeCustomerId: string;
  readonly stripeInvoiceId: string;
  readonly amountDueCents: number;
  readonly attemptCount: number;
  readonly nextPaymentAttempt: Date | null;
}

/** Result of processing a webhook event. */
export type WebhookResult =
  | { readonly processed: true; readonly eventType: string }
  | { readonly processed: false; readonly reason: "already_processed" | "unhandled_event" }
  | { readonly processed: false; readonly reason: "verification_failed"; readonly detail: string };

export class StripeWebhookHandler {
  readonly #webhookSecret: string;
  readonly #db: WebhookDb;

  constructor(db: WebhookDb) {
    const envVar = brand.env.var("STRIPE_WEBHOOK_SECRET");
    const secret = process.env[envVar];
    if (!secret) {
      throw new BillingConfigError(
        `Stripe webhook secret not set. Expected environment variable: ${envVar}`,
        "stripe-webhook",
      );
    }
    this.#webhookSecret = secret;
    this.#db = db;
  }

  /**
   * Process a Stripe webhook request.
   *
   * @param rawBody    The raw request body bytes — must NOT have been parsed as
   *                   JSON first; parsing breaks HMAC verification.
   * @param signature  The value of the `stripe-signature` header.
   */
  async processWebhook(rawBody: Uint8Array, signature: string): Promise<WebhookResult> {
    // Step 1: Verify signature BEFORE doing anything with the payload.
    // An unverified payload could be forged by an attacker.
    const verifyResult = await this.#verifySignature(rawBody, signature);
    if (!verifyResult.ok) {
      return { processed: false, reason: "verification_failed", detail: verifyResult.reason };
    }

    const event = JSON.parse(new TextDecoder().decode(rawBody)) as StripeEvent;

    // Step 2: Idempotency check — Stripe delivers events at least once.
    const alreadyProcessed = await this.#db.hasProcessedEvent(event.id);
    if (alreadyProcessed) {
      return { processed: false, reason: "already_processed" };
    }

    // Step 3: Dispatch to the appropriate handler.
    switch (event.type) {
      case "checkout.session.completed":
        await this.#handleCheckoutCompleted(event);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.#handleSubscriptionUpsert(event);
        break;
      case "customer.subscription.deleted":
        await this.#handleSubscriptionDeleted(event);
        break;
      case "invoice.paid":
        await this.#handleInvoicePaid(event);
        break;
      case "invoice.payment_failed":
        await this.#handleInvoicePaymentFailed(event);
        break;
      default:
        // Unknown event — acknowledge without processing. Stripe expects a 2xx
        // even for unhandled events; the caller handles the HTTP response.
        return { processed: false, reason: "unhandled_event" };
    }

    // Step 4: Mark event processed AFTER side-effects are committed.
    await this.#db.markEventProcessed(event.id);
    return { processed: true, eventType: event.type };
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async #handleCheckoutCompleted(event: StripeEvent): Promise<void> {
    const session = event.data.object as CheckoutSession;
    if (session.mode !== "subscription") return;
    // The subscription.created event carries the full subscription object and
    // is always emitted before checkout.session.completed, so the subscription
    // row should already exist. This handler is a no-op or a safety reconcile.
    // The workspace ↔ Stripe customer mapping is stored by the checkout success
    // handler in the app layer (not here, as we lack the workspaceId).
  }

  async #handleSubscriptionUpsert(event: StripeEvent): Promise<void> {
    const sub = event.data.object as StripeSub;
    const item = sub.items.data[0];
    if (!item) return;

    const planId = (
      sub.metadata?.["plan_id"] ??
      item.price.metadata?.["plan_id"] ??
      "free"
    ) as PlanId;

    const interval = (item.price.recurring?.interval ?? "month") as "month" | "year";

    await this.#db.upsertSubscription({
      stripeCustomerId: sub.customer,
      stripeSubscriptionId: sub.id,
      stripePriceId: item.price.id,
      planId,
      status: sub.status,
      billingInterval: interval,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at !== null ? new Date(sub.canceled_at * 1000) : null,
      trialEndsAt: sub.trial_end !== null ? new Date(sub.trial_end * 1000) : null,
      seats: sub.quantity ?? 1,
    });
  }

  async #handleSubscriptionDeleted(event: StripeEvent): Promise<void> {
    const sub = event.data.object as StripeSub;
    const item = sub.items.data[0];
    if (!item) return;

    const planId = (sub.metadata?.["plan_id"] ?? "free") as PlanId;

    await this.#db.upsertSubscription({
      stripeCustomerId: sub.customer,
      stripeSubscriptionId: sub.id,
      stripePriceId: item.price.id,
      planId,
      status: "canceled",
      billingInterval: (item.price.recurring?.interval ?? "month") as "month" | "year",
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: false,
      canceledAt: sub.canceled_at !== null ? new Date(sub.canceled_at * 1000) : new Date(),
      trialEndsAt: null,
      seats: sub.quantity ?? 1,
    });
  }

  async #handleInvoicePaid(event: StripeEvent): Promise<void> {
    const inv = event.data.object as StripeInvoice;
    await this.#db.recordInvoicePaid({
      stripeCustomerId: inv.customer,
      stripeInvoiceId: inv.id,
      // Stripe amounts are always integer cents — preserve that invariant.
      amountPaidCents: inv.amount_paid,
      periodStart: new Date(inv.period_start * 1000),
      periodEnd: new Date(inv.period_end * 1000),
    });
  }

  async #handleInvoicePaymentFailed(event: StripeEvent): Promise<void> {
    const inv = event.data.object as StripeInvoice;
    await this.#db.recordInvoicePaymentFailed({
      stripeCustomerId: inv.customer,
      stripeInvoiceId: inv.id,
      amountDueCents: inv.amount_due,
      attemptCount: inv.attempt_count,
      nextPaymentAttempt:
        inv.next_payment_attempt !== null
          ? new Date(inv.next_payment_attempt * 1000)
          : null,
    });
  }

  // ---------------------------------------------------------------------------
  // Signature verification
  // ---------------------------------------------------------------------------

  /**
   * Verify the Stripe-Signature header using HMAC-SHA256.
   *
   * Stripe's scheme: the header is `t=<timestamp>,v1=<signature>[,v1=…]`.
   * The signed payload is `<timestamp>.<rawBody>`. We compute HMAC-SHA256
   * over that string and compare to each v1 value.
   *
   * We also enforce that the timestamp is within a 5-minute tolerance to
   * defend against replay attacks.
   */
  async #verifySignature(
    rawBody: Uint8Array,
    signature: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const parts = signature.split(",");
    let timestamp: number | null = null;
    const v1Sigs: string[] = [];

    for (const part of parts) {
      if (part.startsWith("t=")) {
        timestamp = parseInt(part.slice(2), 10);
      } else if (part.startsWith("v1=")) {
        v1Sigs.push(part.slice(3));
      }
    }

    if (timestamp === null || v1Sigs.length === 0) {
      return { ok: false, reason: "Malformed Stripe-Signature header" };
    }

    const tolerance = 300; // 5 minutes in seconds
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > tolerance) {
      return { ok: false, reason: "Webhook timestamp outside tolerance window (replay attack?)" };
    }

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.#webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    // Signed payload = "<timestamp>.<rawBody>"
    const signedPayload = new Uint8Array([
      ...encoder.encode(`${timestamp}.`),
      ...rawBody,
    ]);

    const sigBytes = await crypto.subtle.sign("HMAC", keyMaterial, signedPayload);
    const computedSig = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const matches = v1Sigs.some((s) => timingSafeEqual(s, computedSig));
    if (!matches) {
      return { ok: false, reason: "Signature mismatch" };
    }

    return { ok: true };
  }
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// Minimal Stripe event type shapes (only what we need from the wire format)
// ---------------------------------------------------------------------------

interface StripeEvent {
  readonly id: string;
  readonly type: string;
  readonly data: { readonly object: Record<string, unknown> };
}

interface StripeSub {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
  readonly items: {
    readonly data: ReadonlyArray<{
      readonly price: {
        readonly id: string;
        readonly recurring: { readonly interval: string } | null;
        readonly metadata: Record<string, string> | null;
      };
    }>;
  };
  readonly current_period_start: number;
  readonly current_period_end: number;
  readonly cancel_at_period_end: boolean;
  readonly canceled_at: number | null;
  readonly trial_end: number | null;
  readonly quantity: number | null;
  readonly metadata: Record<string, string> | null;
}

interface CheckoutSession {
  readonly mode: string;
  readonly customer: string | null;
  readonly subscription: string | null;
  readonly metadata: Record<string, string> | null;
}

interface StripeInvoice {
  readonly id: string;
  readonly customer: string;
  readonly amount_due: number;
  readonly amount_paid: number;
  readonly period_start: number;
  readonly period_end: number;
  readonly attempt_count: number;
  readonly next_payment_attempt: number | null;
}
