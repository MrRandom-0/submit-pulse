/**
 * Dev billing driver — in-memory implementation that lets the app run without
 * a Stripe account or live network access.
 *
 * SAFETY GUARD: this driver throws at construction time if NODE_ENV is
 * "production". It must never reach a production deployment.
 *
 * All state is ephemeral and lost on process restart. Checkout and portal
 * sessions return localhost URLs that log to the console rather than
 * redirecting to Stripe.
 *
 * Amounts are stored as integer cents throughout, consistent with the
 * BillingProvider contract.
 */

import type { PlanId } from "@submitpulse/config/entitlements";
import { PLANS } from "@submitpulse/config/entitlements";
import type {
  BillingInterval,
  BillingProvider,
  CreateCheckoutSessionParams,
  CreateCheckoutSessionResult,
  CreatePortalSessionParams,
  CreatePortalSessionResult,
  InvoiceInfo,
  SubscriptionInfo,
  SubscriptionStatus,
  UpdatePlanParams,
} from "./provider";
import { BillingConfigError } from "./provider";

let _nextId = 1;
function nextId(prefix: string): string {
  return `${prefix}_dev_${(_nextId++).toString().padStart(6, "0")}`;
}

interface DevSubscription {
  id: string;
  status: SubscriptionStatus;
  planId: PlanId;
  priceId: string;
  billingInterval: BillingInterval;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | null;
  trialEndsAt: number | null;
  seats: number;
}

const subscriptions = new Map<string, DevSubscription>();
const invoices = new Map<string, InvoiceInfo[]>();

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function periodEndSec(interval: BillingInterval): number {
  const now = nowSec();
  return interval === "year" ? now + 365 * 86400 : now + 30 * 86400;
}

export class DevBillingProvider implements BillingProvider {
  constructor() {
    if (process.env["NODE_ENV"] === "production") {
      throw new BillingConfigError(
        "DevBillingProvider must not be used in production. " +
          "Set NODE_ENV to development or test, or use StripeProvider.",
        "dev",
      );
    }
    console.warn(
      "[DevBillingProvider] Using in-memory billing driver. " +
        "This is NOT safe for production use.",
    );
  }

  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<CreateCheckoutSessionResult> {
    const sessionId = nextId("cs");
    const url = `http://localhost:3000/_dev/billing/checkout?session=${sessionId}&plan=${params.planId}&workspace=${params.workspaceId}`;
    console.info(`[DevBillingProvider] Checkout session ${sessionId} → ${url}`);

    // Pre-create the subscription so the success handler finds it.
    const subId = nextId("sub");
    const now = nowSec();
    const plan = PLANS[params.planId];
    const sub: DevSubscription = {
      id: subId,
      status: "active",
      planId: params.planId,
      priceId: params.priceId,
      billingInterval: params.billingInterval,
      currentPeriodStart: now,
      currentPeriodEnd: periodEndSec(params.billingInterval),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt: null,
      seats: 1,
    };
    subscriptions.set(subId, sub);

    // Emit a synthetic invoice (integer cents only).
    const amountCents =
      params.billingInterval === "year"
        ? (plan.priceAnnualCents ?? plan.priceMonthlyCents)
        : plan.priceMonthlyCents;

    const inv: InvoiceInfo = {
      id: nextId("in"),
      number: `DEV-${_nextId.toString().padStart(4, "0")}`,
      status: "paid",
      amountDueCents: amountCents,
      amountPaidCents: amountCents,
      currency: "usd",
      periodStart: now,
      periodEnd: sub.currentPeriodEnd,
      hostedInvoiceUrl: null,
      invoicePdf: null,
      createdAt: now,
    };

    const custId = params.stripeCustomerId ?? nextId("cus");
    const existing = invoices.get(custId) ?? [];
    invoices.set(custId, [inv, ...existing]);

    return { sessionId, url };
  }

  async createPortalSession(
    params: CreatePortalSessionParams,
  ): Promise<CreatePortalSessionResult> {
    const url = `http://localhost:3000/_dev/billing/portal?customer=${params.stripeCustomerId}&return=${encodeURIComponent(params.returnUrl)}`;
    console.info(`[DevBillingProvider] Portal session → ${url}`);
    return { url };
  }

  async getSubscription(stripeSubscriptionId: string): Promise<SubscriptionInfo> {
    const sub = subscriptions.get(stripeSubscriptionId);
    if (!sub) {
      // Return a sensible default for unknown IDs in dev.
      const now = nowSec();
      return {
        id: stripeSubscriptionId,
        status: "active",
        planId: "free",
        priceId: "price_dev_free",
        billingInterval: "month",
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 86400,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEndsAt: null,
        seats: 1,
      };
    }
    return { ...sub };
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<SubscriptionInfo> {
    const sub = subscriptions.get(stripeSubscriptionId);
    if (sub) {
      sub.cancelAtPeriodEnd = true;
    }
    return this.getSubscription(stripeSubscriptionId);
  }

  async reactivateSubscription(stripeSubscriptionId: string): Promise<SubscriptionInfo> {
    const sub = subscriptions.get(stripeSubscriptionId);
    if (sub) {
      sub.cancelAtPeriodEnd = false;
      sub.canceledAt = null;
    }
    return this.getSubscription(stripeSubscriptionId);
  }

  async updatePlan(params: UpdatePlanParams): Promise<SubscriptionInfo> {
    const sub = subscriptions.get(params.stripeSubscriptionId);
    if (sub) {
      // Extract planId from the priceId in a dev-friendly way.
      const newPlanId = (
        Object.keys(PLANS) as PlanId[]
      ).find((p) => params.newPriceId.includes(p)) ?? sub.planId;
      sub.planId = newPlanId;
      sub.priceId = params.newPriceId;
    }
    return this.getSubscription(params.stripeSubscriptionId);
  }

  async listInvoices(stripeCustomerId: string, limit = 10): Promise<readonly InvoiceInfo[]> {
    return (invoices.get(stripeCustomerId) ?? []).slice(0, limit);
  }
}
