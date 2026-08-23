import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";
import { PLANS, formatQuota } from "@submitpulse/config/entitlements";

export const metadata: Metadata = {
  title: `Agencies — ${brand.name}`,
  description: `Manage form backends for all your clients from one ${brand.name} dashboard. Client workspaces, white-label reports, and aggregate monitoring.`,
};

const agencyPlan = PLANS.agency;

export default function AgenciesPage() {
  return (
    <>
      {/* Header */}
      <section aria-labelledby="agencies-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="neutral" className="mb-6">For Agencies</Badge>
            <h1 id="agencies-heading" className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              One dashboard for every client site
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              Manage form backends for all your clients from a single{" "}
              {brand.name} workspace. Isolated client environments, aggregate
              monitoring, and white-label reporting.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup">Start agency plan</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/contact">Talk to sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="agency-features-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 id="agency-features-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-10">
            Built for agencies
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Client workspaces",
                body: "Each client gets an isolated workspace with separate forms, submissions, billing visibility, and access control. Hand off access without cross-contamination.",
              },
              {
                title: "Aggregate dashboard",
                body: "Monitor submission volume, delivery health, and incident status across all client sites from one view. Spot problems before clients notice them.",
              },
              {
                title: "White-label PDF reports",
                body: "Export branded performance reports — form health, submission volume, delivery rates — to share directly with clients.",
              },
              {
                title: "Team access control",
                body: `Up to ${formatQuota(agencyPlan.quotas.members)} team members with role-based permissions. Assign teammates to specific client workspaces.`,
              },
              {
                title: "Priority support",
                body: "Agency plan includes priority email support with guaranteed response times. Your client escalations don't wait in a queue.",
              },
              {
                title: "Large quotas",
                body: `${formatQuota(agencyPlan.quotas.forms)} forms, ${formatQuota(agencyPlan.quotas.submissionsPerMonth)} submissions/month, ${formatQuota(agencyPlan.quotas.fileStorageMb)} MB file storage.`,
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.body}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Agency plan details */}
      <section aria-labelledby="agency-plan-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-lg">
            <h2 id="agency-plan-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-8 text-center">
              Agency plan
            </h2>
            <Card className="border-border-strong shadow-elevated">
              <CardContent className="pt-6">
                <p className="text-4xl font-bold text-text-primary">
                  ${(agencyPlan.priceMonthlyCents / 100).toFixed(0)}
                  <span className="text-base font-regular text-text-muted">/mo</span>
                </p>
                {agencyPlan.priceAnnualCents !== null && (
                  <p className="text-sm text-text-muted mt-1">
                    ${(agencyPlan.priceAnnualCents / 100 / 12).toFixed(0)}/mo billed annually
                  </p>
                )}
                <hr className="my-6 border-border" />
                <ul className="flex flex-col gap-3 text-sm" role="list">
                  <li className="flex justify-between">
                    <span className="text-text-muted">Forms</span>
                    <span className="font-medium text-text-primary">{formatQuota(agencyPlan.quotas.forms)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-text-muted">Submissions / month</span>
                    <span className="font-medium text-text-primary">{formatQuota(agencyPlan.quotas.submissionsPerMonth)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-text-muted">Team members</span>
                    <span className="font-medium text-text-primary">{formatQuota(agencyPlan.quotas.members)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-text-muted">File storage</span>
                    <span className="font-medium text-text-primary">{formatQuota(agencyPlan.quotas.fileStorageMb)} MB</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-text-muted">Submission history</span>
                    <span className="font-medium text-text-primary">
                      {agencyPlan.quotas.historyDays === null
                        ? "Unlimited"
                        : `${agencyPlan.quotas.historyDays} days`}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-text-muted">Health tests / month</span>
                    <span className="font-medium text-text-primary">{formatQuota(agencyPlan.quotas.healthTestsPerMonth)}</span>
                  </li>
                </ul>
                <Button variant="primary" size="lg" className="w-full mt-6" asChild>
                  <Link href="/signup">Get started</Link>
                </Button>
                <p className="text-xs text-text-muted text-center mt-3">
                  <Link href="/pricing" className="underline hover:text-text-secondary">
                    See full plan comparison →
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Questions about agency pricing?
          </h2>
          <p className="mt-4 text-base text-text-secondary">
            Talk to us about your client volume and we'll find the right fit.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/contact">Talk to sales</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/pricing">View all plans</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
