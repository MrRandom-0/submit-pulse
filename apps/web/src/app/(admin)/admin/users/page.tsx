/**
 * /admin/users — Search and inspect users.
 *
 * SECURITY: isPlatformAdmin required. Submission content not shown here.
 * Metadata only: email, workspace count, sign-in time, suspension status.
 */

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  EmptyState,
} from "@submitpulse/ui";
import { listAdminUsers } from "@/lib/admin-data";
import { SuspendUserButton } from "./SuspendUserButton";

export const metadata = { title: "Users · Admin" };

function fmtDate(d: Date | null): string {
  if (!d) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AdminUsersPage() {
  const users = await listAdminUsers();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Users</h1>
        <Badge variant="neutral">{users.length} total (fixture)</Badge>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-0">
          {users.length === 0 ? (
            <EmptyState title="No users found" description="Try a different search." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">
                      Workspaces
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">
                      Last sign-in
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-slate-100 font-medium">
                            {user.email}
                          </span>
                          {user.fullName && (
                            <span className="ml-2 text-slate-400 text-xs">
                              {user.fullName}
                            </span>
                          )}
                          {user.isPlatformAdmin && (
                            <Badge variant="info" className="ml-2 text-2xs">
                              admin
                            </Badge>
                          )}
                          {!user.emailVerified && (
                            <Badge variant="warning" className="ml-2 text-2xs">
                              unverified
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {user.id}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                        {user.workspaceCount}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell tabular-nums">
                        {fmtDate(user.lastSignInAt)}
                      </td>
                      <td className="px-4 py-3">
                        {user.suspended ? (
                          <Badge variant="danger">Suspended</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SuspendUserButton
                          userId={user.id}
                          email={user.email}
                          suspended={user.suspended}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
