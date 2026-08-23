/**
 * /admin/audit — Audit trail. Read-only. All admin actions recorded here.
 *
 * This table is append-only — never updated or deleted by application code.
 * Snapshots in 'before'/'after' contain metadata only, never submission content.
 */

import { Card, CardContent, Badge } from "@submitpulse/ui";
import { listAdminAuditLog } from "@/lib/admin-data";

export const metadata = { title: "Audit Log · Admin" };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(d);
}

const ACTOR_V: Record<string, "neutral" | "warning" | "info" | "success"> = {
  support: "warning",
  system: "neutral",
  user: "info",
  api_key: "success",
};

export default async function AdminAuditPage() {
  const entries = await listAdminAuditLog();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Audit log</h1>
        <p className="text-xs text-slate-500">Append-only — never modified</p>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Workspace</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">{fmtDate(entry.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={ACTOR_V[entry.actorType] ?? "neutral"} className="text-2xs">{entry.actorType}</Badge>
                      <span className="text-slate-300 text-xs">{entry.actorLabel ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-100 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{entry.workspaceName}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                    {entry.resourceType && entry.resourceId
                      ? `${entry.resourceType}/${entry.resourceId}`
                      : entry.resourceType ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden xl:table-cell">
                    {entry.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
