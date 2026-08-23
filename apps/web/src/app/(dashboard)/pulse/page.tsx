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
  EmptyState,
} from "@submitpulse/ui";
import { listForms } from "@/lib/dashboard-data";
import type { HealthStatus } from "@/lib/dashboard-data";

function healthToStatus(h: HealthStatus): "healthy" | "degraded" | "failing" | "paused" | "setup_incomplete" {
  return h;
}

export default async function PulsePage() {
  const forms = await listForms();

  const summary = {
    healthy: forms.filter((f) => f.healthStatus === "healthy").length,
    degraded: forms.filter((f) => f.healthStatus === "degraded").length,
    failing: forms.filter((f) => f.healthStatus === "failing").length,
    paused: forms.filter((f) => f.healthStatus === "paused").length,
    setup_incomplete: forms.filter((f) => f.healthStatus === "setup_incomplete").length,
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Pulse monitor</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Synthetic end-to-end health checks for all forms
          </p>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(["healthy", "degraded", "failing", "paused", "setup_incomplete"] as const).map((status) => (
          <Card key={status} className="rounded-card text-center">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-text-primary tabular-nums">
                {summary[status]}
              </div>
              <StatusDot status={status} showLabel />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-form health cards */}
      {forms.length === 0 ? (
        <EmptyState
          title="No forms yet"
          description="Create a form and enable Pulse monitoring to see health checks here."
          action={
            <Button variant="primary" size="sm" asChild>
              <Link href="/forms/new">Create form</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <Card key={form.id} className="rounded-card shadow-card">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/forms/${form.id}`} className="font-medium text-text-primary hover:underline">
                    {form.name}
                  </Link>
                  {form.websiteUrl && (
                    <p className="text-xs text-text-muted truncate mt-0.5">{form.websiteUrl}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <StatusDot status={healthToStatus(form.healthStatus)} showLabel />
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/forms/${form.id}?tab=overview`}>Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
