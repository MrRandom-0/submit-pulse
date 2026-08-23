import * as React from "react";
import {
  Card,
  CardContent,
  Badge,
  StatusDot,
} from "@submitpulse/ui";
import type { ClientWorkspace } from "@/lib/scanner-data";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type HealthStatusInput = ClientWorkspace["overallHealth"];

function healthBadge(h: HealthStatusInput) {
  switch (h) {
    case "healthy":      return <Badge variant="success" size="sm">Healthy</Badge>;
    case "degraded":     return <Badge variant="warning" size="sm">Degraded</Badge>;
    case "failing":      return <Badge variant="danger" size="sm">Failing</Badge>;
    case "paused":       return <Badge variant="neutral" size="sm">Paused</Badge>;
    case "setup_incomplete": return <Badge variant="neutral" size="sm">Incomplete</Badge>;
  }
}

// ---------------------------------------------------------------------------

interface ClientHealthCardProps {
  client: ClientWorkspace;
}

export function ClientHealthCard({ client }: ClientHealthCardProps) {
  const {
    name,
    slug,
    plan,
    formCount,
    healthySummary,
    overallHealth,
    submissionsThisMonth,
    lastActivityAt,
    branding,
  } = client;

  const hasProblems =
    overallHealth === "failing" || overallHealth === "degraded";

  return (
    <Card className="rounded-card shadow-card">
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          {/* Branding logo or initials */}
          <div
            className="shrink-0 w-10 h-10 rounded-md border border-border bg-background flex items-center justify-center overflow-hidden"
            aria-hidden
          >
            {branding?.logoUrl !== undefined ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <span
                className="text-sm font-bold text-text-muted"
                style={
                  branding?.accentColor !== undefined
                    ? { color: branding.accentColor }
                    : undefined
                }
              >
                {name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Client info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-text-primary truncate">{name}</span>
              <Badge variant="neutral" size="sm">{plan}</Badge>
              {healthBadge(overallHealth)}
            </div>
            <p className="text-xs text-text-muted truncate">@{slug}</p>

            {/* Health breakdown mini-bar */}
            <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
              <StatusDot status={overallHealth} />
              <span>{formCount} form{formCount !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{submissionsThisMonth.toLocaleString("en-US")} submissions this month</span>
              {lastActivityAt !== null && (
                <>
                  <span>·</span>
                  <span>Last active {lastActivityAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </>
              )}
            </div>

            {/* Health breakdown counts */}
            <div className="mt-2 flex flex-wrap gap-2">
              {healthySummary.failing > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-danger font-medium">
                  <span aria-hidden>✖</span> {healthySummary.failing} failing
                </span>
              )}
              {healthySummary.degraded > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-warning font-medium">
                  <span aria-hidden>⚠</span> {healthySummary.degraded} degraded
                </span>
              )}
              {healthySummary.healthy > 0 && !hasProblems && (
                <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                  <span aria-hidden>✓</span> {healthySummary.healthy} healthy
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
