/**
 * /admin/workspaces — Browse, suspend/restore workspaces, grant credits.
 *
 * SECURITY: isPlatformAdmin required. Metadata only — no submission content.
 */

import {
  Card,
  CardContent,
  Badge,
} from "@submitpulse/ui";
import { listAdminWorkspaces } from "@/lib/admin-data";
import { WorkspaceActions } from "./WorkspaceActions";

export const metadata = { title: "Workspaces · Admin" };

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

const STATUS_BADGE: Record<string, "success" | "danger" | "warning"> = {
  active: "success",
  suspended: "danger",
  pending_deletion: "warning",
};

const PLAN_BADGE: Record<string, "neutral" | "info" | "success" | "warning"> = {
  free: "neutral",
  starter: "info",
  pro: "success",
  enterprise: "warning",
};

export default async function AdminWorkspacesPage() {
  const workspaces = await listAdminWorkspaces();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Workspaces</h1>
        <Badge variant="neutral">{workspaces.length} (fixture)</Badge>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Workspace
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">
                  Owner
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Plan
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">
                  Forms / Submissions
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">
                  Last active
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {workspaces.map((ws) => (
                <tr
                  key={ws.id}
                  className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-slate-100 font-medium">{ws.name}</span>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {ws.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                    {ws.ownerEmail}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={PLAN_BADGE[ws.plan] ?? "neutral"}>
                      {ws.plan}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell tabular-nums">
                    {ws.formCount} / {ws.submissionCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell tabular-nums">
                    {fmtDate(ws.lastActivityAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[ws.status] ?? "neutral"}>
                      {ws.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <WorkspaceActions workspace={ws} />
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
