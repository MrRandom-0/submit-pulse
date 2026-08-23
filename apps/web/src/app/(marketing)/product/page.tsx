import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";

export const metadata: Metadata = {
  title: `Product Overview — ${brand.name}`,
  description: `${brand.tagline} ${brand.description}`,
};

const LOOP_STEPS = [
  {
    phase: "Connect",
    color: "text-info",
    borderColor: "border-info/30",
    title: "One endpoint, any form",
    body: "Create a form endpoint in the dashboard. Point your HTML form action or fetch call at it. Receive a builder-specific AI integration prompt that handles the wire-up automatically.",
    items: [
      "Unique endpoint URL per form",
      "AI integration prompts for every major builder",
      "Supports HTML, React, Vue, Svelte, Astro",
      "multipart/form-data and application/json",
    ],
  },
  {
    phase: "Protect",
    color: "text-warning",
    borderColor: "border-warning/30",
    title: "Spam blocked before it's stored",
    body: "Multi-layer server-side filtering runs on every submission before it touches your inbox. No CAPTCHA friction for your users.",
    items: [
      "Honeypot fields injected by the SDK",
      "Submission velocity rate limiting",
      "Domain reputation scoring",
      "ML-based content classification",
    ],
  },
  {
    phase: "Monitor",
    color: "text-success",
    borderColor: "border-success/30",
    title: "Know before your users do",
    body: "Synthetic health tests probe your forms on a schedule. Schema Drift detection flags field name changes. Incident alerts fire the moment something breaks.",
    items: [
      "Configurable health test frequency",
      "Schema drift detection on every submission",
      "Incident alerts via email or webhook",
      "Status page integration",
    ],
  },
  {
    phase: "Repair",
    color: "text-danger",
    borderColor: "border-danger/30",
    title: "AI-assisted recovery",
    body: "When a schema drift or delivery failure is detected, AI Repair generates a corrected integration prompt you can paste back into your builder to fix the issue.",
    items: [
      "AI-generated repair prompts",
      "Field mapping suggestions",
      "Delivery failure diagnosis",
      "One-click re-queue of failed submissions",
    ],
  },
] as const;

export default function ProductPage() {
  return (
    <>
      {/* Header */}
      <section
        aria-labelledby="product-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="neutral" className="mb-6">
              Product Overview
            </Badge>
            <h1
              id="product-heading"
              className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl"
            >
              Connect. Protect. Monitor. Repair.
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              {brand.name} is form infrastructure for AI-generated and static
              websites. Four phases. One dashboard. Zero silent failures.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup">Start for free</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href={brand.domains.docs}>Documentation</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Core loop */}
      {LOOP_STEPS.map((step, i) => (
        <section
          key={step.phase}
          aria-labelledby={`phase-${step.phase.toLowerCase()}`}
          className={`border-b border-border py-24 ${i % 2 === 0 ? "bg-surface" : "bg-background"}`}
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <span className={`text-xs font-semibold uppercase tracking-wider ${step.color}`}>
                  Phase {i + 1} — {step.phase}
                </span>
                <h2
                  id={`phase-${step.phase.toLowerCase()}`}
                  className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
                >
                  {step.title}
                </h2>
                <p className="mt-4 text-base text-text-secondary leading-relaxed">
                  {step.body}
                </p>
                <ul className="mt-6 flex flex-col gap-2" role="list">
                  {step.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-text-secondary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary flex-none" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <Card className={`border ${step.borderColor}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-sm font-semibold ${step.color}`}>
                      {step.phase}
                    </span>
                    <span className="text-xs text-text-muted">phase active</span>
                  </div>
                  <div className="space-y-2">
                    {step.items.map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 rounded border border-border p-3"
                      >
                        <span className="h-2 w-2 rounded-full bg-success flex-none" />
                        <span className="text-xs text-text-secondary">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      ))}

      {/* Features grid */}
      <section
        aria-labelledby="all-features-heading"
        className="bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2
            id="all-features-heading"
            className="text-3xl font-bold tracking-tight text-text-primary text-center mb-16"
          >
            Everything in one place
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Submission Inbox", body: "Searchable, exportable submission history with raw payload viewer.", href: "/features" },
              { title: "Spam Protection", body: "Multi-layer filtering: honeypot, velocity, domain reputation, ML.", href: "/spam-protection" },
              { title: "Delivery Pipeline", body: "Email, webhooks, and integrations with durable retry queues.", href: "/webhooks" },
              { title: "Pulse Monitor", body: "Synthetic health tests with incident alerting.", href: "/form-monitoring" },
              { title: "Schema Drift", body: "Detects when AI regeneration breaks field names.", href: "/features" },
              { title: "File Uploads", body: "Accept file attachments with S3-compatible storage.", href: "/file-uploads" },
              { title: "AI Repair", body: "Generated repair prompts when something breaks.", href: "/ai-builders" },
              { title: "Agency Dashboard", body: "Client workspaces and aggregate reporting.", href: "/agencies" },
              { title: "Developer API", body: "REST API and typed SDK for programmatic access.", href: "/developers" },
            ].map((item) => (
              <Card key={item.title} interactive>
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.body}</CardDescription>
                  <Link
                    href={item.href}
                    className="mt-4 inline-block text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
                  >
                    Learn more →
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
