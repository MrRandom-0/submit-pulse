/**
 * /admin — Platform ops overview.
 *
 * SECURITY: requires isPlatformAdmin. Checked via AdminGate (server-side).
 * No submission content visible here — metadata only.
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@submitpulse/ui";
import { getPlatformOverview } from "@/lib/admin-data";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export const metadata = { title: "Ops Overview" };

export default async function AdminOverviewPage() {
  const overview = await getPlatformOverview();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Platform overview</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            DEVELOPMENT FIXTURES — not production data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/admin/incidents">
              {overview.openIncidents > 0 ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden />
                  {overview.openIncidents} open incident
                  {overview.openIncidents !== 1 ? "s" : ""}
                </span>
              ) : (
                "All clear"
              )}
            </Link>
          </Button>
        </div>
      </div>

      {/* Key metrics */}
      <section aria-labelledby="platform-metrics">
        <h2 id="platform-metrics" className="sr-only">Platform metrics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <AdminMetricCard
            title="Total workspaces"
            value={overview.totalWorkspaces}
            description={`${overview.activeWorkspaces.toLocaleString()} active`}
          />
          <AdminMetricCard
            title="Suspended"
            value={overview.suspendedWorkspaces}
            variant={overview.suspendedWorkspaces > 0 ? "warning" : "default"}
          />
          <AdminMetricCard
            title="Total forms"
            value={overview.totalForms}
          />
          <AdminMetricCard
            title="Submissions today"
            value={overview.submissionsToday}
          />
          <AdminMetricCard
            title="Submissions this month"
            value={overview.submissionsThisMonth}
          />
          <AdminMetricCard
            title="MRR"
            value={formatCents(overview.mrr)}
            description="Monthly recurring revenue"
            variant="success"
          />
          <AdminMetricCard
            title="Dead-lettered jobs"
            value={overview.deadLetteredJobs}
            variant={overview.deadLetteredJobs > 0 ? "danger" : "default"}
            description="Need manual retry"
          />
          <AdminMetricCard
            title="Security events 24h"
            value={overview.securityEventsLast24h}
            variant={overview.securityEventsLast24h > 20 ? "warning" : "default"}
          />
          <AdminMetricCard
            title="New workspaces today"
            value={overview.newWorkspacesToday}
          />
          <AdminMetricCard
            title="Avg processing"
            value={`${overview.avgProcessingMs}ms`}
          />
          <AdminMetricCard
            title="Open incidents"
            value={overview.openIncidents}
            variant={overview.openIncidents > 0 ? "danger" : "default"}
          />
        </div>
      </section>

      {/* Quick links */}
      <section aria-labelledby="quick-nav-heading">
        <h2
          id="quick-nav-heading"
          className="text-lg font-semibold text-slate-200 mb-4"
        >
          Quick actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            {
              href: "/admin/users",
              label: "Search users",
              desc: "Inspect, suspend or restore",
            },
            {
              href: "/admin/workspaces",
              label: "Workspaces",
              desc: "Suspend, grant credits",
            },
            {
              href: "/admin/jobs",
              label: "Retry dead jobs",
              desc: "Review and replay",
            },
            {
              href: "/admin/security",
              label: "Security events",
              desc: "Auth failures, anomalies",
            },
            {
              href: "/admin/abuse",
              label: "Abuse signals",
              desc: "Volume spikes, flagged accounts",
            },
            {
              href: "/admin/feature-flags",
              label: "Feature flags",
              desc: "Manage rollouts",
            },
            {
              href: "/admin/incidents",
              label: "Incidents",
              desc: "Manage public status",
            },
            {
              href: "/admin/audit",
              label: "Audit log",
              desc: "All admin actions",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col gap-1 p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span className="text-sm font-medium text-slate-100">
                {item.label}
              </span>
              <span className="text-xs text-slate-400">{item.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
