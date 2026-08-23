/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Stripe billing driver. All Stripe API calls use real request shapes against
 * the Stripe REST API v1. No Stripe SDK is used; requests are made via fetch to
 * avoid a hard dependency.
 *
 * Required environment variable (named via brand.env.var()):
 *   SP_STRIPE_SECRET_KEY : Stripe secret key (sk_live_… or sk_test_…)
 *
 * Optional environment variables:
 *   SP_STRIPE_WEBHOOK_SECRET : Webhook signing secret (whsec_…) — required by
 *                              StripeWebhookHandler, not this provider.
 *
 * SECURITY NOTES:
 *   - The secret key is read once at construction and stored in a private field.
 *   - Amounts are never accepted from client-side input. Prices are identified
 *     by priceId and resolved server-side against Stripe's records.
 *   - All money values returned from Stripe are in integer cents; this driver
 *     preserves that invariant and never converts to floats.
 *
 * PlanId ↔ Stripe Price mapping:
 *   The mapping between PlanId and Stripe Price IDs is managed via environment
 *   variables (SP_STRIPE_PRICE_*) or a configuration table, not hardcoded here.
 *   The caller passes the priceId from its own configuration.
 */

import { brand } from "@submitpulse/config/brand";
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
import { BillingApiError, BillingConfigError } from "./provider";
import type { PlanId } from "@submitpulse/config/entitlements";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export class StripeProvider implements BillingProvider {
  readonly #secretKey: string;

  constructor() {
    const envVar = brand.env.var("STRIPE_SECRET_KEY");
    const key = process.env[envVar];
    if (!key) {
      throw new BillingConfigError(
        `Stripe secret key not set. Expected environment variable: ${envVar}`,
        "stripe",
      );
    }
    if (!key.startsWith("sk_live_") && !key.startsWith("sk_test_")) {
      throw new BillingConfigError(
        `${envVar} does not look like a valid Stripe secret key (must start with sk_live_ or sk_test_)`,
        "stripe",
      );
    }
    this.#secretKey = key;
  }

  #authHeader(): string {
    return `Basic ${btoa(this.#secretKey + ":")}`;
  }

  async #stripeRequest<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: this.#authHeader(),
      "Stripe-Version": "2023-10-16",
      "User-Agent": brand.wire.userAgent,
    };

    let bodyStr: string | undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      bodyStr = encodeFormBody(body);
    }

    const res = await fetch(`${STRIPE_API_BASE}${path}`, {
      method,
      headers,
      body: bodyStr,
    });

    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const err = json["error"] as Record<string, unknown> | undefined;
      throw new BillingApiError(
        String(err?.["message"] ?? `Stripe API error HTTP ${res.status}`),
        "stripe",
        res.status,
        String(err?.["code"] ?? ""),
      );
    }

    return json as T;
  }

  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<CreateCheckoutSessionResult> {
    type SessionResponse = { id: string; url: string };

    const body: Record<string, unknown> = {
      mode: "subscription",
      "line_items[0][price]": params.priceId,
      "line_items[0][quantity]": 1,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      "metadata[workspace_id]": params.workspaceId,
      "metadata[plan_id]": params.planId,
    };

    if (params.stripeCustomerId) {
      body["customer"] = params.stripeCustomerId;
    } else if (params.customerEmail) {
      body["customer_email"] = params.customerEmail;
    }

    const session = await this.#stripeRequest<SessionResponse>(
      "POST",
      "/checkout/sessions",
      body,
    );

    return { sessionId: session.id, url: session.url };
  }

  async createPortalSession(
    params: CreatePortalSessionParams,
  ): Promise<CreatePortalSessionResult> {
    type PortalResponse = { url: string };

    const session = await this.#stripeRequest<PortalResponse>(
      "POST",
      "/billing_portal/sessions",
      {
        customer: params.stripeCustomerId,
        return_url: params.returnUrl,
      },
    );

    return { url: session.url };
  }

  async getSubscription(stripeSubscriptionId: string): Promise<SubscriptionInfo> {
    type StripeSubscription = {
      id: string;
      status: string;
      "items": { data: Array<{ price: { id: string; metadata: Record<string, string> } }> };
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
      canceled_at: number | null;
      trial_end: number | null;
      metadata: Record<string, string>;
      quantity: number;
    };

    const sub = await this.#stripeRequest<StripeSubscription>(
      "GET",
      `/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`,
    );

    const item = sub["items"].data[0];
    const priceId = item?.price.id ?? "";
    const planId = (sub.metadata["plan_id"] ?? item?.price.metadata["plan_id"] ?? "free") as PlanId;
    const interval = (sub.metadata["billing_interval"] ?? "month") as BillingInterval;

    return {
      id: sub.id,
      status: sub.status as SubscriptionStatus,
      planId,
      priceId,
      billingInterval: interval,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at,
      trialEndsAt: sub.trial_end,
      seats: sub.quantity ?? 1,
    };
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<SubscriptionInfo> {
    await this.#stripeRequest(
      "POST",
      `/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`,
      { cancel_at_period_end: true },
    );
    return this.getSubscription(stripeSubscriptionId);
  }

  async reactivateSubscription(stripeSubscriptionId: string): Promise<SubscriptionInfo> {
    await this.#stripeRequest(
      "POST",
      `/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`,
      { cancel_at_period_end: false },
    );
    return this.getSubscription(stripeSubscriptionId);
  }

  async updatePlan(params: UpdatePlanParams): Promise<SubscriptionInfo> {
    type StripeSubItems = { data: Array<{ id: string }> };

    // Fetch current subscription to get the subscription item ID.
    type MinSub = { items: StripeSubItems };
    const sub = await this.#stripeRequest<MinSub>(
      "GET",
      `/subscriptions/${encodeURIComponent(params.stripeSubscriptionId)}`,
    );

    const itemId = sub.items.data[0]?.id;
    if (!itemId) {
      throw new BillingApiError("Subscription has no items", "stripe");
    }

    await this.#stripeRequest(
      "POST",
      `/subscriptions/${encodeURIComponent(params.stripeSubscriptionId)}`,
      {
        [`items[0][id]`]: itemId,
        [`items[0][price]`]: params.newPriceId,
        proration_behavior: params.prorationBehavior,
      },
    );

    return this.getSubscription(params.stripeSubscriptionId);
  }

  async listInvoices(stripeCustomerId: string, limit = 10): Promise<readonly InvoiceInfo[]> {
    type StripeInvoice = {
      id: string;
      number: string | null;
      status: string;
      amount_due: number;
      amount_paid: number;
      currency: string;
      period_start: number;
      period_end: number;
      hosted_invoice_url: string | null;
      invoice_pdf: string | null;
      created: number;
    };
    type InvoiceList = { data: StripeInvoice[] };

    const result = await this.#stripeRequest<InvoiceList>(
      "GET",
      `/invoices?customer=${encodeURIComponent(stripeCustomerId)}&limit=${limit}`,
    );

    return result.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status as InvoiceInfo["status"],
      amountDueCents: inv.amount_due,
      amountPaidCents: inv.amount_paid,
      currency: "usd" as const,
      periodStart: inv.period_start,
      periodEnd: inv.period_end,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      invoicePdf: inv.invoice_pdf,
      createdAt: inv.created,
    }));
  }
}

/** Encode a nested object as application/x-www-form-urlencoded for Stripe. */
function encodeFormBody(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v)) {
      parts.push(encodeFormBody(v as Record<string, unknown>, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v ?? ""))}`);
    }
  }
  return parts.join("&");
}
