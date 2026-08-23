import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@submitpulse/ui";
import { NAV_GROUPS } from "./content";

export const metadata: Metadata = {
  title: `Documentation — ${brand.name}`,
  description: `Learn how to integrate ${brand.name} into any website or framework.`,
};

interface SectionCard {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly badge: string;
  readonly badgeVariant: "info" | "success" | "warning" | "neutral";
}

const TOP_SECTIONS: readonly SectionCard[] = [
  {
    title: "Quickstart",
    description: "Send your first submission in under three minutes.",
    href: "/docs/quickstart",
    badge: "Start here",
    badgeVariant: "success",
  },
  {
    title: "API Reference",
    description:
      "Interactive reference for the ingestion endpoint — status codes, request headers, error codes, and response shapes.",
    href: "/docs/api",
    badge: "Interactive",
    badgeVariant: "info",
  },
  {
    title: "Webhook Reference",
    description:
      "Event payloads, signature verification, and worked HMAC examples in Node and Python.",
    href: "/docs/webhook-reference",
    badge: "Webhooks",
    badgeVariant: "warning",
  },
  {
    title: "Security",
    description:
      "Domain allowlists, rate limits, signed webhooks, and why the form ID is public.",
    href: "/security",
    badge: "Security",
    badgeVariant: "neutral",
  },
];

export default function DocsLandingPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      {/* Header */}
      <div className="mb-14 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-text-primary mb-4">
          Documentation
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          Everything you need to integrate {brand.name} into any website —
          plain HTML, React, Next.js, Vue, Svelte, Astro, and every major AI
          builder.
        </p>
      </div>

      {/* Top-level sections */}
      <section aria-labelledby="sections-heading" className="mb-16">
        <h2
          id="sections-heading"
          className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-6"
        >
          Documentation sections
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOP_SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-card">
              <Card interactive className="h-full transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={s.badgeVariant} size="sm">
                      {s.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-base group-hover:text-primary transition-colors">
                    {s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{s.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Integration guides */}
      <section aria-labelledby="guides-heading" className="mb-16">
        <h2
          id="guides-heading"
          className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-6"
        >
          Integration guides
        </h2>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                {group.label}
              </h3>
              <ul className="space-y-2" role="list">
                {group.items.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/docs/${item.slug}`}
                      className="text-sm text-text-secondary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* SDKs & API */}
      <section aria-labelledby="sdk-heading" className="mb-16">
        <h2
          id="sdk-heading"
          className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-6"
        >
          SDKs
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono">
                {brand.packages.browser}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Typed browser client for form submission. Handles error parsing,
                retry logic, and the structured response shape.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-mono">
                {brand.packages.react}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                React hooks wrapping the browser client. Provides{" "}
                <code className="text-xs bg-code-background px-1 py-0.5 rounded font-mono">
                  useSubmit
                </code>{" "}
                for state management with loading, error, and success states.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Webhooks & Security */}
      <section aria-labelledby="webhook-heading">
        <h2
          id="webhook-heading"
          className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-6"
        >
          Reference
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              title: "Webhook events",
              body: "Six event types: submission.created, submission.updated, submission.spam, submission.restored, form.health.failed, form.schema.changed.",
              href: "/docs/webhook-reference",
            },
            {
              title: "Signature verification",
              body: "HMAC-SHA256 signing with replay-window protection. Worked examples in Node.js and Python.",
              href: "/docs/webhook-reference",
            },
            {
              title: "OpenAPI specification",
              body: "Machine-readable OpenAPI 3.1 spec covering all endpoints, schemas, and webhook events.",
              href: `${brand.domains.api}/openapi.yaml`,
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-card"
            >
              <Card interactive className="h-full">
                <CardHeader>
                  <CardTitle className="text-base group-hover:text-primary transition-colors">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.body}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
