/**
 * @submitpulse/billing — billing layer.
 *
 * Production paths (StripeProvider, StripeWebhookHandler) are marked
 * INCOMPLETE — NOT PRODUCTION VERIFIED.
 *
 * DevBillingProvider is available for local development and throws in
 * production (NODE_ENV === "production").
 */

export type {
  BillingInterval,
  BillingProvider,
  CreateCheckoutSessionParams,
  CreateCheckoutSessionResult,
  CreatePortalSessionParams,
  CreatePortalSessionResult,
  InvoiceInfo,
  PriceId,
  SubscriptionInfo,
  SubscriptionStatus,
  UpdatePlanParams,
} from "./provider";
export { BillingApiError, BillingConfigError } from "./provider";

export { StripeProvider } from "./stripe-provider";
export { DevBillingProvider } from "./dev-provider";

export type { WebhookDb, WebhookResult, SubscriptionUpsert, InvoicePaid, InvoicePaymentFailed } from "./webhook-handler";
export { StripeWebhookHandler } from "./webhook-handler";

export type {
  MeteringDb,
  UsageEventInput,
  UsageMetric,
  UsageProjection,
  UsageSummary,
} from "./usage-metering";
export { METRIC_TO_QUOTA_KEY, UsageMeteringService } from "./usage-metering";

export type { EntitlementDb, WorkspaceSubscription } from "./entitlement-service";
export { EntitlementService } from "./entitlement-service";

export type {
  DunningAction,
  DunningDb,
  DunningRecord,
  DunningState,
  InvoiceFailedEvent,
  InvoicePaidEvent,
} from "./dunning";
export { DunningStateMachine } from "./dunning";
