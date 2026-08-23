import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";
import { ORDERED_PLANS, FEATURE_KEYS, formatQuota } from "@submitpulse/config/entitlements";
import type { FeatureKey } from "@submitpulse/config/entitlements";

export const metadata: Metadata = {
  title: `Features — ${brand.name}`,
  description: `Explore all ${brand.name} features: submission inbox, spam protection, delivery pipeline, pulse monitoring, schema drift detection, file uploads, and more.`,
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

const FEATURES_OVERVIEW = [
  {
    category: "Core",
    items: [
      {
        title: "Submission Inbox",
        body: "Every submission is stored, searchable, and exportable. View raw payloads, filter by field value or spam score, and export to CSV.",
        badge: "All plans" as const,
      },
      {
        title: "Custom Thank-You Redirects",
        body: "Configure per-form redirect URLs after successful submission. Supports query parameter passthrough for tracking.",
        badge: "All plans" as const,
      },
      {
        title: "Email Notifications",
        body: "Receive an email for every submission. Configurable recipients, subject templates, and field inclusion.",
        badge: "All plans" as const,
      },
    ],
  },
  {
    category: "Spam & Security",
    items: [
      {
        title: "Honeypot Fields",
        body: "Hidden fields injected by the SDK catch basic bots before they reach the server.",
        badge: "All plans" as const,
      },
      {
        title: "Rate Limiting",
        body: "Per-IP and per-form submission velocity limits block flood attacks.",
        badge: "All plans" as const,
      },
      {
        title: "Advanced Spam Protection",
        body: "Domain reputation scoring, ML-based content classification, and configurable spam thresholds.",
        badge: "Pro+" as const,
      },
      {
        title: "Domain Allowlists",
        body: "Restrict submissions to specific origins. Requests from unlisted domains are rejected with a 403.",
        badge: "Starter+" as const,
      },
    ],
  },
  {
    category: "Delivery",
    items: [
      {
        title: "Webhooks",
        body: "POST submission data to any URL. Signed with HMAC-SHA256. Automatic retry with exponential back-off.",
        badge: "Starter+" as const,
      },
      {
        title: "Autoresponders",
        body: "Send a customisable confirmation email to submitters automatically.",
        badge: "Starter+" as const,
      },
      {
        title: "Third-party Integrations",
        body: "Native connectors for Slack, Notion, Airtable, Google Sheets, and more.",
        badge: "Pro+" as const,
      },
    ],
  },
  {
    category: "Monitoring",
    items: [
      {
        title: "Pulse Monitor",
        body: "Synthetic health tests submit to your forms on a configurable schedule. Incident alerts fire on failure.",
        badge: "Pro+" as const,
      },
      {
        title: "Schema Drift Detection",
        body: "Detects when field names change between submissions and alerts before integrations break.",
        badge: "Pro+" as const,
      },
      {
        title: "AI Repair",
        body: "Generates a builder-specific repair prompt when drift or delivery failure is detected.",
        badge: "Pro+" as const,
      },
    ],
  },
  {
    category: "Storage",
    items: [
      {
        title: "File Uploads",
        body: "Accept file attachments via multipart/form-data. Files stored in isolated, signed storage.",
        badge: "Pro+" as const,
      },
      {
        title: "Submission History",
        body: "Configurable retention from 7 days (Free) to 2 years (Agency).",
        badge: "All plans" as const,
      },
    ],
  },
  {
    category: "Agency",
    items: [
      {
        title: "Client Workspaces",
        body: "Isolated namespaces per client with separate billing, access control, and submission storage.",
        badge: "Agency" as const,
      },
      {
        title: "White-label Reports",
        body: "Export branded PDF performance reports to share directly with clients.",
        badge: "Agency" as const,
      },
      {
        title: "MCP Server",
        body: "AI coding agents can create and configure forms programmatically during project setup.",
        badge: "Pro+" as const,
      },
    ],
  },
] as const;

export default function FeaturesPage() {
  return (
    <>
      {/* Header */}
      <section
        aria-labelledby="features-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="neutral" className="mb-6">
              Features
            </Badge>
            <h1
              id="features-heading"
              className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl"
            >
              Everything your forms need. Nothing they don't.
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              A complete form backend: intake, spam filtering, delivery,
              monitoring, and repair — all in one place.
            </p>
          </div>
        </div>
      </section>

      {/* Features by category */}
      {FEATURES_OVERVIEW.map((group) => (
        <section
          key={group.category}
          aria-labelledby={`cat-${group.category.toLowerCase()}`}
          className="border-b border-border bg-surface py-16"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2
              id={`cat-${group.category.toLowerCase()}`}
              className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-8"
            >
              {group.category}
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <Card key={item.title}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <Badge variant="neutral" size="sm">
                        {item.badge}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{item.body}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Plan comparison table */}
      <section
        aria-labelledby="compare-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2
            id="compare-heading"
            className="text-3xl font-bold tracking-tight text-text-primary text-center mb-12"
          >
            Feature comparison
          </h2>
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="py-4 px-6 text-left font-semibold text-text-primary w-1/3">
                    Feature
                  </th>
                  {ORDERED_PLANS.map((plan) => (
                    <th
                      key={plan.id}
                      className="py-4 px-4 text-center font-semibold text-text-primary"
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Quota rows */}
                <tr className="border-b border-border bg-surface/50">
                  <td colSpan={ORDERED_PLANS.length + 1} className="px-6 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Quotas
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-6 text-text-secondary">Forms</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center text-text-primary">
                      {formatQuota(plan.quotas.forms)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border bg-surface/30">
                  <td className="py-3 px-6 text-text-secondary">Submissions / month</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center text-text-primary">
                      {formatQuota(plan.quotas.submissionsPerMonth)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-6 text-text-secondary">Team members</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center text-text-primary">
                      {formatQuota(plan.quotas.members)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border bg-surface/30">
                  <td className="py-3 px-6 text-text-secondary">History retention</td>
                  {ORDERED_PLANS.map((plan) => (
                    <td key={plan.id} className="py-3 px-4 text-center text-text-primary">
                      {plan.quotas.historyDays === null
                        ? "Unlimited"
                        : `${plan.quotas.historyDays}d`}
                    </td>
                  ))}
                </tr>

                {/* Feature rows */}
                <tr className="border-b border-border bg-surface/50">
                  <td colSpan={ORDERED_PLANS.length + 1} className="px-6 py-2">
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
                          <span className="text-success" aria-label="Included">
                            ✓
                          </span>
                        ) : (
                          <span className="text-text-muted" aria-label="Not included">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 text-center">
            <Button variant="primary" asChild>
              <Link href="/pricing">See full pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Ready to add reliable forms to your site?
          </h2>
          <p className="mt-4 text-base text-text-secondary">
            Free plan available. No credit card required.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/signup">Start for free</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
