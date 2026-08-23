import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  StatusDot,
  Button,
  Skeleton,
  SkeletonText,
  EmptyState,
} from "@submitpulse/ui";
import { PLANS } from "@submitpulse/config";
import { getOverviewMetrics } from "@/lib/dashboard-data";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { UsageMeter } from "@/components/dashboard/UsageMeter";
import type { HealthStatus } from "@/lib/dashboard-data";

// ---------------------------------------------------------------------------
// Fixture actor for server-side rendering (replace with real session in prod)
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function healthToStatusDot(h: HealthStatus): "healthy" | "degraded" | "failing" | "paused" | "setup_incomplete" {
  return h;
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function OverviewPage() {
  const metrics = await getOverviewMetrics();
  const plan = PLANS[metrics.plan];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Overview</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {/* DEVELOPMENT FIXTURES — not live data */}
            Development fixtures — replace with real data before shipping.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/forms">View all forms</Link>
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link href="/forms/new">New form</Link>
          </Button>
        </div>
      </div>

      {/* Metric grid */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">Key metrics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Submissions today"
            value={metrics.submissionsToday}
            icon={<span aria-hidden>▤</span>}
          />
          <MetricCard
            title="Submissions this month"
            value={metrics.submissionsThisMonth}
            icon={<span aria-hidden>▥</span>}
          />
          <MetricCard
            title="Spam blocked"
            value={metrics.spamBlockedThisMonth}
            icon={<span aria-hidden>⊘</span>}
            description="This billing period"
          />
          <MetricCard
            title="Active forms"
            value={metrics.activeForms}
            icon={<span aria-hidden>◻</span>}
          />
          <MetricCard
            title="Forms healthy"
            value={metrics.formsHealthy}
            description={`of ${metrics.activeForms} active`}
            trend={
              metrics.formsHealthy === metrics.activeForms
                ? { direction: "up", label: "All forms healthy" }
                : {
                    direction: "down",
                    label: `${metrics.activeForms - metrics.formsHealthy} need attention`,
                  }
            }
          />
          <MetricCard
            title="Failed deliveries"
            value={metrics.failedDeliveries}
            trend={
              metrics.failedDeliveries > 0
                ? { direction: "down", label: "Review webhook logs" }
                : { direction: "up", label: "No failures" }
            }
          />
          <MetricCard
            title="Avg processing time"
            value={formatMs(metrics.avgProcessingMs)}
            description="Ingestion to storage"
          />
          <MetricCard
            title="Plan"
            value={plan.name}
            description={`$${(plan.priceMonthlyCents / 100).toFixed(0)}/month`}
          />
        </div>
      </section>

      {/* Plan usage */}
      <section aria-labelledby="usage-heading">
        <Card className="rounded-card shadow-card">
          <CardHeader>
            <CardTitle id="usage-heading">Plan usage</CardTitle>
            <CardDescription>
              {plan.name} plan — billing period resets monthly
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-6">
            <UsageMeter
              label="Submissions"
              used={metrics.submissionsUsed}
              quota={metrics.submissionsQuota}
            />
            <UsageMeter
              label="Forms"
              used={metrics.formsUsed}
              quota={metrics.formsQuota}
            />
          </CardContent>
        </Card>
      </section>

      {/* Main 2-col grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Activity timeline */}
        <section aria-labelledby="activity-heading" className="lg:col-span-1">
          <Card className="rounded-card shadow-card h-full">
            <CardHeader>
              <CardTitle id="activity-heading">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline events={metrics.recentActivity} />
            </CardContent>
          </Card>
        </section>

        {/* Latest submissions */}
        <section aria-labelledby="latest-submissions-heading" className="lg:col-span-2">
          <Card className="rounded-card shadow-card h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle id="latest-submissions-heading">
                  Latest submissions
                </CardTitle>
                <CardDescription>Most recent across all forms</CardDescription>
              </div>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/submissions">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {metrics.latestSubmissions.length === 0 ? (
                <EmptyState
                  title="No submissions yet"
                  description="Submissions will appear here once your forms are live."
                />
              ) : (
                <ul role="list">
                  {metrics.latestSubmissions.map((sub) => {
                    const previewName = sub.previewFields[0]?.value ?? sub.publicId;
                    const previewEmail =
                      sub.previewFields.find((f) => f.name.includes("email"))?.value ?? "";
                    const isNew = sub.status === "new" && sub.readAt === null;

                    return (
                      <li key={sub.id} className="border-b border-border last:border-0">
                        <Link
                          href={`/submissions/${sub.id}`}
                          className="flex items-center gap-3 px-6 py-3 hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
                        >
                          <span
                            className={`h-2 w-2 rounded-full flex-shrink-0 ${isNew ? "bg-primary" : "bg-transparent"}`}
                            aria-hidden
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${isNew ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                              {previewName}
                            </p>
                            <p className="text-xs text-text-muted truncate">
                              {sub.formName}
                              {previewEmail ? ` · ${previewEmail}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {sub.spamVerdict !== "clean" && (
                              <Badge variant={sub.spamVerdict === "spam" ? "danger" : "warning"}>
                                {sub.spamVerdict}
                              </Badge>
                            )}
                            <span className="text-xs text-text-muted tabular-nums hidden sm:block">
                              {new Intl.DateTimeFormat("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(sub.createdAt)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Form health summary */}
      <section aria-labelledby="health-summary-heading">
        <Card className="rounded-card shadow-card">
          <CardHeader>
            <CardTitle id="health-summary-heading">Form health</CardTitle>
            <CardDescription>Pulse monitor status for all forms</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {metrics.formHealthSummary.length === 0 ? (
              <EmptyState
                title="No forms yet"
                description="Create your first form to start monitoring health."
                action={
                  <Button variant="primary" size="sm" asChild>
                    <Link href="/forms/new">Create form</Link>
                  </Button>
                }
              />
            ) : (
              <ul role="list">
                {metrics.formHealthSummary.map((f) => (
                  <li key={f.id} className="border-b border-border last:border-0">
                    <Link
                      href={`/forms/${f.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
                    >
                      <span className="text-sm font-medium text-text-primary truncate">
                        {f.name}
                      </span>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {f.lastSubmissionAt && (
                          <span className="text-xs text-text-muted hidden sm:block">
                            Last:{" "}
                            {new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(f.lastSubmissionAt)}
                          </span>
                        )}
                        <StatusDot status={healthToStatusDot(f.healthStatus)} showLabel />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick actions */}
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="text-lg font-semibold text-text-primary mb-4">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { href: "/forms/new", label: "New form", desc: "Start accepting submissions" },
            { href: "/submissions", label: "View inbox", desc: "Browse all submissions" },
            { href: "/pulse", label: "Pulse monitor", desc: "Check health status" },
            { href: "/integrations", label: "Integrations", desc: "Connect Zapier, webhooks" },
            { href: "/usage", label: "Usage & limits", desc: "Track your quota" },
            { href: "/billing", label: "Upgrade plan", desc: "Unlock more features" },
            { href: "/team", label: "Invite teammate", desc: "Collaborate on forms" },
            { href: "/settings", label: "Settings", desc: "Configure workspace" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`
                flex flex-col gap-1 p-4 rounded-card border border-border bg-background
                hover:bg-surface hover:border-border-strong transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring
              `}
            >
              <span className="text-sm font-medium text-text-primary">
                {action.label}
              </span>
              <span className="text-xs text-text-muted">{action.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
