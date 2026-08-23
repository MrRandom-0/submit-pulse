/**
 * Sub-processor list
 *
 * DRAFT — not legally reviewed. Sub-processor details must be verified against
 * actual vendor contracts, DPAs, and SCCs before this page is published.
 * No actual vendor relationships have been established; the services listed
 * below are planned/intended, not contracted.
 */

import type { Metadata } from "next";
import { brand } from "@submitpulse/config/brand";
import { Card, CardContent, Badge } from "@submitpulse/ui";

export const metadata: Metadata = {
  title: `Sub-processors — ${brand.name}`,
  description: `List of third-party sub-processors used by ${brand.name} to provide the service.`,
};

const LAST_UPDATED = "2025-08-23";

const SUBPROCESSORS = [
  {
    name: "Supabase",
    purpose: "Database (PostgreSQL) and user authentication",
    location: "United States (AWS us-east-1 by default; region configurable)",
    website: "https://supabase.com",
    dpaLink: "https://supabase.com/privacy",
    transferMechanism: "Standard Contractual Clauses",
  },
  {
    name: "Cloudflare",
    purpose: "Edge compute (Workers), form submission ingestion, CDN, DDoS protection, Turnstile CAPTCHA, R2 object storage, D1 database, KV storage, Queues",
    location: "Global edge network (submission processing occurs at the edge nearest to the submitter)",
    website: "https://cloudflare.com",
    dpaLink: "https://www.cloudflare.com/cloudflare-customer-dpa/",
    transferMechanism: "Standard Contractual Clauses",
  },
  {
    name: "Resend",
    purpose: "Transactional email delivery (submission notifications, autoresponders, system emails)",
    location: "United States",
    website: "https://resend.com",
    dpaLink: "https://resend.com/legal/dpa",
    transferMechanism: "Standard Contractual Clauses",
  },
  {
    name: "Stripe",
    purpose: "Payment processing and subscription management",
    location: "United States",
    website: "https://stripe.com",
    dpaLink: "https://stripe.com/legal/dpa",
    transferMechanism: "Standard Contractual Clauses",
  },
  {
    name: "Upstash",
    purpose: "Redis-compatible rate limiting state (transient, non-personal data)",
    location: "United States (configurable)",
    website: "https://upstash.com",
    dpaLink: "https://upstash.com/trust/dpa.pdf",
    transferMechanism: "Standard Contractual Clauses",
  },
] as const;

export default function SubprocessorsPage() {
  return (
    <section aria-labelledby="sp-heading" className="bg-background py-24">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">

        {/* Draft warning banner */}
        <Card className="mb-10 border-warning/40 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Badge variant="warning" className="shrink-0 mt-0.5">Unreviewed Draft</Badge>
              <div className="text-sm text-text-secondary leading-relaxed">
                <strong className="text-text-primary">This sub-processor list has not been legally reviewed and is not yet accurate.</strong>{" "}
                None of the vendor relationships listed below have been contracted. No DPAs have
                been signed with any vendor. No Standard Contractual Clauses are in place.
                Transfer mechanisms listed are based on each vendor's published offerings, not
                on executed agreements. This list must be verified against actual vendor contracts
                before it is published to customers.
              </div>
            </div>
          </CardContent>
        </Card>

        <header className="mb-12">
          <h1 id="sp-heading" className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Sub-processors
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Last updated: <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>
          <p className="mt-4 text-sm text-text-secondary">
            {brand.name} uses the following third-party sub-processors to provide the service.
            We require all sub-processors to maintain appropriate data protection standards
            and to enter into data processing agreements with us. We will notify customers
            of material additions or changes to this list with at least 30 days' advance notice
            at{" "}
            <a href={`mailto:${brand.email.privacy}`} className="text-brand-primary hover:underline">
              {brand.email.privacy}
            </a>.
          </p>
        </header>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-3 pr-4 text-text-primary font-semibold w-36">Sub-processor</th>
                <th className="py-3 pr-4 text-text-primary font-semibold">Purpose</th>
                <th className="py-3 pr-4 text-text-primary font-semibold w-52">Data location</th>
                <th className="py-3 text-text-primary font-semibold w-44">Transfer mechanism</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {SUBPROCESSORS.map((sp) => (
                <tr key={sp.name} className="align-top">
                  <td className="py-4 pr-4">
                    <a
                      href={sp.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-primary hover:underline font-medium"
                    >
                      {sp.name}
                    </a>
                  </td>
                  <td className="py-4 pr-4 text-text-secondary">{sp.purpose}</td>
                  <td className="py-4 pr-4 text-text-secondary">{sp.location}</td>
                  <td className="py-4 text-text-secondary">
                    {sp.transferMechanism}{" "}
                    <a
                      href={sp.dpaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-primary hover:underline text-xs"
                    >
                      (DPA)
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden flex flex-col gap-4">
          {SUBPROCESSORS.map((sp) => (
            <Card key={sp.name}>
              <CardContent className="pt-5 text-sm space-y-2">
                <div>
                  <a
                    href={sp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-primary hover:underline font-semibold"
                  >
                    {sp.name}
                  </a>
                </div>
                <div className="text-text-secondary">{sp.purpose}</div>
                <div className="text-text-muted text-xs">{sp.location}</div>
                <div className="text-text-muted text-xs">
                  {sp.transferMechanism}{" "}
                  <a
                    href={sp.dpaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-primary hover:underline"
                  >
                    (DPA)
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 text-sm text-text-muted">
          <p>
            To object to a new sub-processor or request further information, contact{" "}
            <a href={`mailto:${brand.email.privacy}`} className="text-brand-primary hover:underline">
              {brand.email.privacy}
            </a>.
          </p>
        </div>

      </div>
    </section>
  );
}
