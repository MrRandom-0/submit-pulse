/**
 * /admin/incidents — Manage public status incidents.
 *
 * SECURITY: Do NOT expose internal hostnames, queue names, stack traces,
 * or vendor names in incident updates. Public-facing updates must be
 * reviewed before publishing.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from "@submitpulse/ui";
import { listAdminIncidents } from "@/lib/admin-data";

export const metadata = { title: "Incidents · Admin" };

function fmtDate(d: Date | null) {
  if (!d) return "Ongoing";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

const IMPACT_V: Record<string, "neutral" | "warning" | "danger" | "info"> = {
  none: "neutral", minor: "info", major: "warning", critical: "danger",
};
const STATUS_V: Record<string, "warning" | "neutral" | "info" | "success"> = {
  investigating: "warning", identified: "info", monitoring: "neutral", resolved: "success",
};

export default async function AdminIncidentsPage() {
  const incidents = await listAdminIncidents();
  const open = incidents.filter((i) => i.status !== "resolved");

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Incidents</h1>
        <div className="flex gap-2">
          {open.length > 0 && (
            <Badge variant="danger">{open.length} open</Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {incidents.map((incident) => (
          <Card key={incident.id} className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-slate-100 text-base">
                    {incident.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={STATUS_V[incident.status] ?? "neutral"}>
                      {incident.status}
                    </Badge>
                    <Badge variant={IMPACT_V[incident.impact] ?? "neutral"}>
                      {incident.impact} impact
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-slate-500 tabular-nums flex-shrink-0">
                  {fmtDate(incident.createdAt)} — {fmtDate(incident.resolvedAt)}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {incident.affectedComponents.map((c) => (
                  <Badge key={c} variant="neutral" className="text-2xs">{c}</Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {incident.updates.map((update) => (
                <div key={update.id} className="pl-4 border-l-2 border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={STATUS_V[update.status] ?? "neutral"} className="text-2xs">
                      {update.status}
                    </Badge>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {fmtDate(update.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{update.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
