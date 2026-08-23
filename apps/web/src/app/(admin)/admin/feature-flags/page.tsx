/**
 * /admin/feature-flags — Manage platform feature flags.
 * Toggle is an audited action.
 */

import {
  Card,
  CardContent,
  Badge,
} from "@submitpulse/ui";
import { listAdminFeatureFlags } from "@/lib/admin-data";
import { FeatureFlagToggle } from "./FeatureFlagToggle";

export const metadata = { title: "Feature Flags · Admin" };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export default async function AdminFeatureFlagsPage() {
  const flags = await listAdminFeatureFlags();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Feature flags</h1>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Key</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Global</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Rollout</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Workspaces</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-100 font-mono text-xs">{flag.key}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell max-w-xs">
                    {flag.description ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {flag.enabledGlobally ? (
                      <Badge variant="success">On</Badge>
                    ) : (
                      <Badge variant="neutral">Off</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums hidden lg:table-cell">
                    {flag.rolloutPercent}%
                  </td>
                  <td className="px-4 py-3 text-slate-400 tabular-nums hidden lg:table-cell">
                    {flag.enabledWorkspaceIds.length}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden xl:table-cell">
                    {fmtDate(flag.updatedAt)}
                    {flag.updatedByUserEmail && (
                      <span className="ml-1 text-slate-600">by {flag.updatedByUserEmail}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FeatureFlagToggle flagId={flag.id} flagKey={flag.key} enabledGlobally={flag.enabledGlobally} />
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
