/**
 * /admin/forms — Platform-wide form list with pause capability.
 *
 * SECURITY: Metadata only. No submission content visible.
 * Pausing a form is an audited action.
 */

import {
  Card,
  CardContent,
  Badge,
} from "@submitpulse/ui";
import { listAdminForms } from "@/lib/admin-data";
import { PauseFormButton } from "./PauseFormButton";

export const metadata = { title: "Forms · Admin" };

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function failureRateBadge(rate: number) {
  if (rate >= 0.5) return <Badge variant="danger">{(rate * 100).toFixed(0)}%</Badge>;
  if (rate >= 0.1) return <Badge variant="warning">{(rate * 100).toFixed(0)}%</Badge>;
  return <Badge variant="success">{(rate * 100).toFixed(0)}%</Badge>;
}

export default async function AdminFormsPage() {
  const forms = await listAdminForms();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Forms</h1>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Form</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Workspace</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Submissions</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Failure 24h</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">Last submission</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr key={form.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-slate-100 font-medium">{form.name}</span>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{form.publicId}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{form.workspaceName}</td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums hidden lg:table-cell">
                    {form.submissionCount.toLocaleString()}
                    <span className="text-slate-500 text-xs ml-1">
                      ({form.spamBlockedCount} blocked)
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {failureRateBadge(form.failureRate24h)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs tabular-nums hidden xl:table-cell">
                    {fmtDate(form.lastSubmissionAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={form.status === "active" ? "success" : form.status === "paused" ? "warning" : "neutral"}>
                      {form.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PauseFormButton formId={form.id} formName={form.name} workspaceId={form.workspaceId} paused={form.status === "paused"} />
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
