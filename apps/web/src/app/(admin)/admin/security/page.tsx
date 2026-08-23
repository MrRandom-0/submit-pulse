/**
 * /admin/security — Security events. IP addresses and UA families only.
 * Never expose full user-agent strings or internal stack traces.
 */

import { Card, CardContent, Badge } from "@submitpulse/ui";
import { listAdminSecurityEvents } from "@/lib/admin-data";

export const metadata = { title: "Security · Admin" };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(d);
}

const SEV: Record<string, "success" | "warning" | "danger"> = {
  info: "success",
  warning: "warning",
  critical: "danger",
};

export default async function AdminSecurityPage() {
  const events = await listAdminSecurityEvents();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Security events</h1>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Kind</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Severity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">IP address</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">UA family</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">{fmtDate(ev.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-100 font-mono text-xs">{ev.kind}</td>
                  <td className="px-4 py-3">
                    <Badge variant={SEV[ev.severity] ?? "neutral"}>{ev.severity}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                    {ev.userEmail ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs hidden lg:table-cell">
                    {ev.ipAddress ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden xl:table-cell">
                    {ev.uaFamily ?? "—"}
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
