/**
 * /admin/webhooks — Webhook delivery log.
 * NOTE: Shows target host only, never the full URL (may contain secrets in query strings).
 */

import { Card, CardContent, Badge } from "@submitpulse/ui";
import { listAdminWebhookDeliveries } from "@/lib/admin-data";

export const metadata = { title: "Webhooks · Admin" };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

const STATUS_V: Record<string, "success" | "danger" | "neutral"> = {
  delivered: "success",
  failed: "danger",
  pending: "neutral",
};

export default async function AdminWebhooksPage() {
  const deliveries = await listAdminWebhookDeliveries();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Webhook delivery log</h1>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Workspace</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Form</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">HTTP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Target host</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">Attempts</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">{fmtDate(d.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-100">{d.workspaceName}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{d.formName}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_V[d.status] ?? "neutral"}>{d.status}</Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums hidden lg:table-cell">
                    {d.httpStatus ? (
                      <span className={d.httpStatus >= 400 ? "text-danger" : "text-green-400"}>
                        {d.httpStatus}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs hidden lg:table-cell">{d.targetHost}</td>
                  <td className="px-4 py-3 text-slate-400 tabular-nums hidden xl:table-cell">{d.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
