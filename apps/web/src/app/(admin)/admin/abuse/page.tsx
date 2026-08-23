/**
 * /admin/abuse — Abuse signals. Links to workspace actions.
 */

import Link from "next/link";
import { Card, CardContent, Badge, Button } from "@submitpulse/ui";
import { listAdminAbuseSignals } from "@/lib/admin-data";

export const metadata = { title: "Abuse · Admin" };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

const SEV: Record<string, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export default async function AdminAbusePage() {
  const signals = await listAdminAbuseSignals();
  const open = signals.filter((s) => !s.resolved);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Abuse signals</h1>
        {open.length > 0 && (
          <Badge variant="danger">{open.length} unresolved</Badge>
        )}
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Workspace</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Signal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Severity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Detail</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {signals.map((sig) => (
                <tr key={sig.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">{fmtDate(sig.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-100 font-medium">{sig.workspaceName}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{sig.signal}</td>
                  <td className="px-4 py-3">
                    <Badge variant={SEV[sig.severity] ?? "neutral"}>{sig.severity}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell max-w-xs truncate">
                    {sig.detail}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!sig.resolved && (
                      <Button variant="danger" size="sm" asChild>
                        <Link href={`/admin/workspaces`}>Investigate</Link>
                      </Button>
                    )}
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
