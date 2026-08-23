/**
 * /status — Public status page.
 *
 * SECURITY / PRIVACY CONSTRAINTS (comment enforced here):
 * ─────────────────────────────────────────────────────────────────────────
 * This page is public and must NEVER expose:
 *   - Internal hostnames, service names, or IP addresses
 *   - Queue names (e.g. "bullmq", "inngest", "sqs")
 *   - Vendor names (e.g. "Resend", "Postmark", "Upstash", "PlanetScale")
 *   - Stack traces or error messages
 *   - Database schema details
 *   - Internal metric names or labels
 *   - Any data that could aid an attacker in understanding the architecture
 *
 * Component labels are product-facing, not infrastructure-facing.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { brand } from "@submitpulse/config";
import { listAdminIncidents } from "@/lib/admin-data";
import { StatusDot, Badge } from "@submitpulse/ui";

export const metadata = {
  title: `System Status · ${brand.name}`,
  description: `Current status and incident history for ${brand.name} services.`,
};

// ---------------------------------------------------------------------------
// Component definitions — product-facing names only, no internal details
// ---------------------------------------------------------------------------

interface ComponentStatus {
  id: string;
  /** Product-facing label. Never use internal service/vendor names. */
  label: string;
  status: "healthy" | "degraded" | "failing" | "maintenance";
  /** 0–1: fraction of the last 90 days this component was operational. */
  uptime90d: number;
}

/**
 * FIXTURE: static component statuses.
 * In production, derive these from your synthetic monitor results.
 * Do NOT pipe raw infrastructure metrics here.
 */
const COMPONENTS: ComponentStatus[] = [
  { id: "api", label: "Form submission API", status: "healthy", uptime90d: 0.9998 },
  { id: "dashboard", label: "Dashboard", status: "healthy", uptime90d: 0.9995 },
  { id: "submissions", label: "Submission processing", status: "healthy", uptime90d: 0.9993 },
  { id: "email", label: "Email notifications", status: "healthy", uptime90d: 0.9981 },
  { id: "webhooks", label: "Webhook delivery", status: "degraded", uptime90d: 0.9912 },
  { id: "files", label: "File processing", status: "healthy", uptime90d: 0.9989 },
  { id: "monitoring", label: "Form health monitoring", status: "healthy", uptime90d: 0.9996 },
];

// ---------------------------------------------------------------------------
// 90-day uptime strip — 90 daily buckets
// ---------------------------------------------------------------------------

function UptimeStrip({ uptime90d }: { uptime90d: number }) {
  // Simulate 90 days of data. In production, compute from real daily metrics.
  const buckets = Array.from({ length: 90 }, (_, i) => {
    // Mostly healthy; simulate a few degraded/failing days based on uptime
    const r = Math.sin(i * 7 + uptime90d * 100) * 0.5 + 0.5;
    if (uptime90d < 0.995 && i > 70 && r > 0.85) return "degraded";
    if (uptime90d < 0.98 && i > 80 && r > 0.9) return "failing";
    return "healthy";
  });

  const colorMap = {
    healthy: "bg-green-500",
    degraded: "bg-amber-400",
    failing: "bg-red-500",
  } as const;

  return (
    <div className="flex gap-px" aria-label={`90-day uptime: ${(uptime90d * 100).toFixed(2)}%`}>
      {buckets.map((status, i) => (
        <div
          key={i}
          className={`h-6 flex-1 rounded-sm ${colorMap[status as keyof typeof colorMap] ?? "bg-slate-600"}`}
          title={`Day ${90 - i}: ${status}`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function overallStatus(
  components: ComponentStatus[],
): "operational" | "partial_outage" | "major_outage" | "maintenance" {
  if (components.some((c) => c.status === "failing")) return "major_outage";
  if (components.some((c) => c.status === "degraded")) return "partial_outage";
  if (components.some((c) => c.status === "maintenance")) return "maintenance";
  return "operational";
}

function statusToStatusDot(
  s: ComponentStatus["status"],
): "healthy" | "degraded" | "failing" | "paused" {
  if (s === "maintenance") return "paused";
  return s;
}

const IMPACT_COLOR: Record<string, string> = {
  none: "text-slate-400",
  minor: "text-blue-400",
  major: "text-amber-400",
  critical: "text-red-400",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function StatusPage() {
  const incidents = await listAdminIncidents();
  const recentIncidents = incidents.slice(0, 10);
  const overall = overallStatus(COMPONENTS);

  const overallLabel = {
    operational: "All systems operational",
    partial_outage: "Partial service disruption",
    major_outage: "Service disruption",
    maintenance: "Scheduled maintenance",
  }[overall];

  const overallBg = {
    operational: "bg-green-950/40 border-green-800/50 text-green-300",
    partial_outage: "bg-amber-950/40 border-amber-800/50 text-amber-300",
    major_outage: "bg-red-950/40 border-red-800/50 text-red-300",
    maintenance: "bg-slate-800/40 border-slate-700 text-slate-300",
  }[overall];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <a
            href={brand.domains.marketing}
            className="text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            {brand.name}
          </a>
          <span className="text-xs text-slate-500">Status</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-12">
        {/* Overall status */}
        <section aria-labelledby="overall-status">
          <div
            className={`rounded-xl border px-6 py-5 ${overallBg}`}
            role="status"
            aria-live="polite"
          >
            <h1 id="overall-status" className="text-xl font-bold">
              {overallLabel}
            </h1>
            <p className="text-sm mt-1 opacity-80">
              Last updated:{" "}
              <time dateTime={new Date().toISOString()}>
                {new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                  timeZoneName: "short",
                }).format(new Date())}
              </time>
            </p>
          </div>
        </section>

        {/* Component statuses */}
        <section aria-labelledby="components-heading">
          <h2
            id="components-heading"
            className="text-lg font-semibold text-slate-100 mb-4"
          >
            Components
          </h2>
          <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
            {COMPONENTS.map((comp) => (
              <div
                key={comp.id}
                className="px-5 py-4 bg-slate-900 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    {/* StatusDot maps to our existing component */}
                    <StatusDot status={statusToStatusDot(comp.status)} showLabel />
                    <span className="text-sm font-medium text-slate-100">
                      {comp.label}
                    </span>
                  </div>
                  <UptimeStrip uptime90d={comp.uptime90d} />
                  <div className="flex justify-between mt-1 text-xs text-slate-500">
                    <span>90 days ago</span>
                    <span>{(comp.uptime90d * 100).toFixed(2)}% uptime</span>
                    <span>Today</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Incident history */}
        <section aria-labelledby="incidents-heading">
          <h2
            id="incidents-heading"
            className="text-lg font-semibold text-slate-100 mb-4"
          >
            Incident history
          </h2>

          {recentIncidents.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-8 text-center">
              <p className="text-slate-400 text-sm">No incidents in the last 90 days.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentIncidents.map((incident) => (
                <article
                  key={incident.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4"
                  aria-label={incident.title}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        {incident.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={
                            incident.status === "resolved"
                              ? "success"
                              : incident.status === "monitoring"
                              ? "neutral"
                              : "warning"
                          }
                        >
                          {incident.status}
                        </Badge>
                        <span
                          className={`text-xs ${IMPACT_COLOR[incident.impact] ?? "text-slate-400"}`}
                        >
                          {incident.impact} impact
                        </span>
                      </div>
                    </div>
                    <time
                      dateTime={incident.createdAt.toISOString()}
                      className="text-xs text-slate-500 tabular-nums flex-shrink-0"
                    >
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(incident.createdAt)}
                    </time>
                  </div>

                  <div className="space-y-2">
                    {incident.updates.map((update) => (
                      <div
                        key={update.id}
                        className="pl-3 border-l-2 border-slate-700"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-slate-400 capitalize">
                            {update.status}
                          </span>
                          <span className="text-xs text-slate-600">·</span>
                          <time
                            dateTime={update.createdAt.toISOString()}
                            className="text-xs text-slate-500 tabular-nums"
                          >
                            {new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(update.createdAt)}
                          </time>
                        </div>
                        {/* Update text: plain language only, no internal details */}
                        <p className="text-sm text-slate-300">{update.message}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Subscribe / contact */}
        <section
          aria-labelledby="subscribe-heading"
          className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-6 text-center"
        >
          <h2
            id="subscribe-heading"
            className="text-base font-semibold text-slate-100 mb-2"
          >
            Stay informed
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Questions about an incident? Contact{" "}
            <a
              href={`mailto:${brand.email.support}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {brand.email.support}
            </a>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-4 py-6 mt-12">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs text-slate-500">
          <span>{brand.name}</span>
          <a
            href={brand.domains.marketing}
            className="hover:text-slate-300 transition-colors"
          >
            {brand.domains.apex}
          </a>
        </div>
      </footer>
    </div>
  );
}
