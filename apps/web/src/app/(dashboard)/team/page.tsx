import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  EmptyState,
} from "@submitpulse/ui";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { PermissionGate } from "@/components/dashboard/PermissionGate";
import type { WorkspaceRole } from "@submitpulse/auth/permissions";

const FIXTURE_ACTOR: Actor = {
  userId: "user-001",
  workspaceId: "ws-1",
  role: "admin",
};

const FIXTURE_MEMBERS = [
  { id: "user-001", name: "Alice Johnson", email: "alice@example.com", role: "admin" as WorkspaceRole, joinedAt: new Date(Date.now() - 90 * 86400_000) },
  { id: "user-002", name: "Bob Smith", email: "bob@example.com", role: "developer" as WorkspaceRole, joinedAt: new Date(Date.now() - 30 * 86400_000) },
  { id: "user-003", name: "Carol Williams", email: "carol@example.com", role: "viewer" as WorkspaceRole, joinedAt: new Date(Date.now() - 7 * 86400_000) },
];

const ROLE_BADGE: Record<WorkspaceRole, "success" | "info" | "neutral" | "warning"> = {
  owner: "success",
  admin: "info",
  developer: "neutral",
  viewer: "warning",
};

export default function TeamPage() {
  const actor = FIXTURE_ACTOR;
  const canInvite = can(actor, "member:invite");
  const canUpdateRole = can(actor, "member:update_role");
  const canRemove = can(actor, "member:remove");

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Team</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {FIXTURE_MEMBERS.length} member{FIXTURE_MEMBERS.length !== 1 ? "s" : ""}
          </p>
        </div>
        <PermissionGate actor={actor} permission="member:invite">
          <Button variant="primary" size="sm">Invite member</Button>
        </PermissionGate>
      </div>

      <Card className="rounded-card shadow-card">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th scope="col" className="px-6 py-3 text-left font-medium text-text-secondary">Member</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-text-secondary">Role</th>
                <th scope="col" className="px-6 py-3 text-left font-medium text-text-secondary hidden sm:table-cell">Joined</th>
                <th scope="col" className="px-6 py-3 text-right font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {FIXTURE_MEMBERS.map((member) => (
                <tr key={member.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center flex-shrink-0 select-none">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">{member.name}</p>
                        <p className="text-xs text-text-muted">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={ROLE_BADGE[member.role]}>{member.role}</Badge>
                  </td>
                  <td className="px-6 py-4 text-text-muted hidden sm:table-cell">
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(member.joinedAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {canUpdateRole && member.id !== actor.userId && (
                        <Button variant="secondary" size="sm">Change role</Button>
                      )}
                      {canRemove && member.id !== actor.userId && (
                        <Button variant="danger" size="sm">Remove</Button>
                      )}
                    </div>
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
