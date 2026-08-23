/**
 * /admin/jobs — Background job queue mirror. Supports retry of dead-lettered jobs.
 *
 * SECURITY: Audited. Retry is a mutating action that writes to audit_logs.
 * Job payloads are NOT shown — they may contain workspace data. Metadata only.
 */

import { Card, CardContent, Badge } from "@submitpulse/ui";
import { listAdminJobs } from "@/lib/admin-data";
import { RetryJobButton } from "./RetryJobButton";

export const metadata = { title: "Jobs · Admin" };

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(d);
}

const STATUS_V: Record<string, "success" | "danger" | "warning" | "neutral" | "info"> = {
  completed: "success",
  failed: "danger",
  dead_lettered: "danger",
  running: "info",
  pending: "neutral",
};

export default async function AdminJobsPage() {
  const jobs = await listAdminJobs();
  const deadCount = jobs.filter((j) => j.status === "dead_lettered").length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Background jobs</h1>
        {deadCount > 0 && (
          <Badge variant="danger">{deadCount} dead-lettered</Badge>
        )}
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Queue / Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Attempts</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Workspace</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">Last error</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <span className="text-slate-100 font-medium">{job.jobType}</span>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{job.queue}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_V[job.status] ?? "neutral"}>{job.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 tabular-nums hidden md:table-cell">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                    {job.workspaceName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs tabular-nums hidden lg:table-cell">
                    {fmtDate(job.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate hidden xl:table-cell">
                    {job.lastError ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(job.status === "dead_lettered" || job.status === "failed") && (
                      <RetryJobButton
                        jobId={job.id}
                        jobType={job.jobType}
                        workspaceId={job.workspaceId ?? "platform"}
                      />
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
