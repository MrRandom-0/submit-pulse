import { Button, Badge, Card, CardContent, CardHeader, CardTitle, cn } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";
import {
  ORDERED_PLANS,
  FEATURE_KEYS,
  PLAN_IDS,
  formatQuota,
} from "@submitpulse/config/entitlements";
import type { FeatureKey } from "@submitpulse/config/entitlements";

export const metadata: Metadata = {
  title: `Pricing — ${brand.name}`,
  description: `Simple, transparent pricing for ${brand.name}. Start free. Upgrade when you need more forms, submissions, or monitoring.`,
};

const FEATURE_LABELS: Record<FeatureKey, string> = {
  autoresponders: "Autoresponders",
  webhooks: "Webhooks",
  domainRules: "Domain allowlists",
  fileUploads: "File uploads",
  advancedSpam: "Advanced spam protection",
  pulseMonitor: "Pulse Monitor",
  schemaDrift: "Schema Drift detection",
  aiRepair: "AI Repair",
  integrations: "Third-party integrations",
  analytics: "Analytics",
  mcpServer: "MCP server",
  clientWorkspaces: "Client workspaces",
  agencyDashboard: "Agency dashboard",
  whiteLabelReports: "White-label reports",
  prioritySupport: "Priority support",
};

export default function PricingPage() {
  return (
    <>
      {/* Header */}
      <section
        aria-labelledby="pricing-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="neutral" className="mb-6">
              Pricing
            </Badge>
            <h1
              id="pricing-heading"
              className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl"
            >
              Simple, transparent pricing
            </h1>
            <p className="mt-6 text-lg text-text-secondary">
              Start free. Upgrade when you need more.
            </p>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section aria-label="Pricing plans" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ORDERED_PLANS.map((plan) => {
              const isPro = plan.id === "pro";
              const isFree = plan.id === "free";
              const monthlyPrice = plan.priceMonthlyCents / 100;
              const annualMonthlyEquiv =
                plan.priceAnnualCents !== null
                  ? plan.priceAnnualCents / 100 / 12
                  : null;

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "flex flex-col",
                    isPro && "border-primary/40 shadow-elevated"
                  )}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {isPro && <Badge variant="info" size="sm">Popular</Badge>}
                    </div>
                    <div className="mt-4">
                      {isFree ? (
                        <p className="text-3xl font-bold text-text-primary">
                          Free
                        </p>
                      ) : (
                        <>
                          <p className="text-3xl font-bold text-text-primary">
                            ${monthlyPrice.toFixed(0)}
                            <span className="text-base font-regular text-text-muted">
                              /mo
                            </span>
                          </p>
                          {annualMonthlyEquiv !== null && (
                            <p className="text-xs text-text-muted mt-1">
                              ${annualMonthlyEquiv.toFixed(0)}/mo billed annually
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 pt-4">
                    {/* Quotas */}
                    <ul className="flex flex-col gap-3 text-sm" role="list">
                      <li className="flex justify-between">
                        <span className="text-text-muted">Forms</span>
                        <span className="font-medium text-text-primary">
                          {formatQuota(plan.quotas.forms)}
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-text-muted">Submissions/mo</span>
                        <span className="font-medium text-text-primary">
                          {formatQuota(plan.quotas.submissionsPerMonth)}
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-text-muted">Team members</span>
                        <span className="font-medium text-text-primary">
                          {formatQuota(plan.quotas.members)}
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-text-muted">History</span>
                        <span className="font-medium text-text-primary">
                          {plan.quotas.historyDays === null
                            ? "Unlimited"
                            : `${plan.quotas.historyDays}d`}
                        </span>
                      </li>
                      {plan.quotas.fileStorageMb > 0 && (
                        <li className="flex justify-between">
                          <span className="text-text-muted">File storage</span>
                          <span className="font-medium text-text-primary">
                            {formatQuota(plan.quotas.fileStorageMb)} MB
                          </span>
                        </li>
                      )}
                      {plan.quotas.healthTestsPerMonth > 0 && (
                        <li className="flex justify-between">
                          <span className="text-text-muted">Health tests/mo</span>
                          <span className="font-medium text-text-primary">
                            {formatQuota(plan.quotas.healthTestsPerMonth)}
                          </span>
                        </li>
                      )}
                    </ul>

                    <hr className="my-4 border-border" />

                    {/* Features */}
                    <ul className="flex flex-col gap-2 text-sm flex-1" role="list">
                      {FEATURE_KEYS.map((key) => (
                        <li
                          key={key}
                          className={cn(
                            "flex items-center gap-2",
                            plan.features[key]
                              ? "text-text-secondary"
                              : "text-text-muted opacity-50"
                          )}
                        >
                          <span
                            className={cn(
                              "text-xs",
                              plan.features[key] ? "text-success" : "text-text-muted"
                            )}
                            aria-label={plan.features[key] ? "Included" : "Not included"}
                          >
                            {plan.features[key] ? "✓" : "—"}
                          </span>
                          {FEATURE_LABELS[key]}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6">
                      <Button
                        variant={isPro ? "primary" : "secondary"}
                        size="md"
                        className="w-full"
                        asChild
                      >
                        <Link href={isFree ? "/signup" : "/signup"}>
                          {isFree ? "Start for free" : `Get ${plan.name}`}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Full comparison table */}
      <section
        aria-labelledby="full-compare-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2
            id="full-compare-heading"
            className="text-2xl font-bold tracking-tight text-text-primary text-center mb-12"
          >
            Full plan comparison
          </h2>
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="py-4 px-6 text-left font-semibold text-text-primary w-1/3">
                    —
                  </th>
                  {ORDERED_PLANS.map((plan) => (
                    <th
                      key={plan.id}
                      className={cn(
                        "py-4 px-4 text-center font-semibold",
                        plan.id === "pro" ? "text-primary" : "text-text-primary"
                      )}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Price row */}
                <tr className="border-b border-border">
                  <td className="py-3 px-6 font-medium text-text-primary">Monthly price</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center text-text-primary">
                      {plan.priceMonthlyCents === 0
                        ? "Free"
                        : `$${(plan.priceMonthlyCents / 100).toFixed(0)}`}
                    </td>
                  ))}
                </tr>

                {/* Quota section header */}
                <tr className="border-b border-border bg-surface/50">
                  <td colSpan={PLAN_IDS.length + 1} className="px-6 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Quotas
                    </span>
                  </td>
                </tr>

                <tr className="border-b border-border">
                  <td className="py-3 px-6 text-text-secondary">Forms</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center">
                      {formatQuota(plan.quotas.forms)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border bg-surface/30">
                  <td className="py-3 px-6 text-text-secondary">Submissions / month</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center">
                      {formatQuota(plan.quotas.submissionsPerMonth)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-6 text-text-secondary">Team members</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center">
                      {formatQuota(plan.quotas.members)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border bg-surface/30">
                  <td className="py-3 px-6 text-text-secondary">Submission history</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center">
                      {plan.quotas.historyDays === null
                        ? "Unlimited"
                        : `${plan.quotas.historyDays} days`}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-6 text-text-secondary">File storage</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center">
                      {plan.quotas.fileStorageMb === 0
                        ? "—"
                        : `${formatQuota(plan.quotas.fileStorageMb)} MB`}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border bg-surface/30">
                  <td className="py-3 px-6 text-text-secondary">Health tests / month</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center">
                      {plan.quotas.healthTestsPerMonth === 0
                        ? "—"
                        : formatQuota(plan.quotas.healthTestsPerMonth)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-6 text-text-secondary">AI analyses / month</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center">
                      {plan.quotas.aiAnalysesPerMonth === 0
                        ? "—"
                        : formatQuota(plan.quotas.aiAnalysesPerMonth)}
                    </td>
                  ))}
                </tr>

                {/* Feature section header */}
                <tr className="border-b border-border bg-surface/50">
                  <td colSpan={PLAN_IDS.length + 1} className="px-6 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Features
                    </span>
                  </td>
                </tr>

                {FEATURE_KEYS.map((key, idx) => (
                  <tr
                    key={key}
                    className={`border-b border-border ${idx % 2 === 0 ? "" : "bg-surface/30"}`}
                  >
                    <td className="py-3 px-6 text-text-secondary">
                      {FEATURE_LABELS[key]}
                    </td>
                    {ORDERED_PLANS.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center">
                        {plan.features[key] ? (
                          <span className="text-success" aria-label="Included">✓</span>
                        ) : (
                          <span className="text-text-muted" aria-label="Not included">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="pricing-faq-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <h2
              id="pricing-faq-heading"
              className="text-2xl font-bold tracking-tight text-text-primary mb-10"
            >
              Pricing questions
            </h2>
            <dl className="flex flex-col gap-8">
              {[
                {
                  q: "Can I change plans at any time?",
                  a: "Yes. Upgrades take effect immediately and are prorated. Downgrades take effect at the next billing cycle.",
                },
                {
                  q: "What happens if I exceed my submission limit?",
                  a: "Submissions over the limit are queued and you are notified. You can upgrade or they will be processed in the next billing cycle.",
                },
                {
                  q: "Is annual billing available?",
                  a: `Yes, on all paid plans. Annual billing gives you a significant discount versus monthly. Pricing shown above is monthly.`,
                },
                {
                  q: "Do you offer a free trial?",
                  a: "The Free plan is permanently free. Paid plan features can be explored via a trial — contact us for details.",
                },
                {
                  q: "What payment methods do you accept?",
                  a: "All major credit and debit cards. Bank transfer is available for Agency plan on request.",
                },
              ].map((item) => (
                <div key={item.q}>
                  <dt className="text-base font-semibold text-text-primary">{item.q}</dt>
                  <dd className="mt-2 text-sm text-text-secondary leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Start with the free plan today
          </h2>
          <p className="mt-4 text-base text-text-secondary">
            No credit card required. Upgrade any time.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/signup">Create free account</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/contact">Talk to sales</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
