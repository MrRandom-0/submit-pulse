/**
 * /admin/subscriptions — Billing subscriptions overview.
 * NOTE: stripeCustomerId shows prefix only to reduce blast radius if logs leak.
 */

import { Card, CardContent, Badge } from "@submitpulse/ui";
import { listAdminSubscriptions } from "@/lib/admin-data";

export const metadata = { title: "Subscriptions · Admin" };

function fmtCents(c: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(c / 100);
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

const PLAN_V: Record<string, "neutral" | "info" | "success" | "warning"> = { free: "neutral", starter: "info", pro: "success", enterprise: "warning" };
const STATUS_V: Record<string, "success" | "danger" | "warning" | "neutral"> = { active: "success", trialing: "info", past_due: "danger", canceled: "neutral", unpaid: "danger" };

export default async function AdminSubscriptionsPage() {
  const subs = await listAdminSubscriptions();
  const totalMrr = subs.reduce((a, s) => a + s.mrr, 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Subscriptions</h1>
        <div className="text-sm text-slate-400">
          MRR (fixture): <span className="text-green-400 font-semibold">{fmtCents(totalMrr)}</span>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Workspace</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Period end</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">MRR</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">Stripe</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-100 font-medium">
                    {s.workspaceName}
                    {s.cancelAtPeriodEnd && (
                      <Badge variant="warning" className="ml-2 text-2xs">cancels</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{s.ownerEmail}</td>
                  <td className="px-4 py-3">
                    <Badge variant={PLAN_V[s.plan] ?? "neutral"}>{s.plan}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_V[s.status] ?? "neutral"}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs tabular-nums hidden lg:table-cell">{fmtDate(s.currentPeriodEnd)}</td>
                  <td className="px-4 py-3 text-green-400 tabular-nums font-medium hidden lg:table-cell">{fmtCents(s.mrr)}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden xl:table-cell">{s.stripeCustomerPrefix}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
