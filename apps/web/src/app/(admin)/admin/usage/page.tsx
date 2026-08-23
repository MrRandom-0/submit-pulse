/**
 * /admin/usage — Per-workspace usage summary. Metadata only.
 */

import { Card, CardContent, Badge } from "@submitpulse/ui";
import { listAdminUsage } from "@/lib/admin-data";

export const metadata = { title: "Usage · Admin" };

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminUsagePage() {
  const usage = await listAdminUsage();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Usage</h1>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Workspace</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Submissions</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Emails</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Webhooks</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Storage</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => {
                const pct = u.submissionsQuota
                  ? (u.submissionsAccepted / u.submissionsQuota) * 100
                  : null;
                const warn = pct !== null && pct >= 80;

                return (
                  <tr key={u.workspaceId} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-100 font-medium">{u.workspaceName}</td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{u.plan}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`tabular-nums font-medium ${warn ? "text-amber-400" : "text-slate-100"}`}>
                        {u.submissionsAccepted.toLocaleString()}
                      </span>
                      {u.submissionsQuota && (
                        <span className="text-slate-500 text-xs ml-1">
                          / {u.submissionsQuota.toLocaleString()}
                          {pct !== null && ` (${pct.toFixed(0)}%)`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums hidden md:table-cell">{u.emailDelivered.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums hidden lg:table-cell">{u.webhookAttempts.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums hidden lg:table-cell">{fmtBytes(u.storageBytes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
