"use client";

/**
 * SuspendUserButton — audited suspend/restore for a user account.
 *
 * SECURITY: Every action writes an audit_logs entry via auditedAction()
 * before mutating the database. actorType is 'support'.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
  Textarea,
  Label,
} from "@submitpulse/ui";
import { auditedAction } from "@/components/admin/auditedAction";
import { FIXTURE_OPS_EMAIL } from "@/lib/admin-data";

interface SuspendUserButtonProps {
  userId: string;
  email: string;
  suspended: boolean;
}

export function SuspendUserButton({
  userId,
  email,
  suspended,
}: SuspendUserButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const action = suspended ? "restore" : "suspend";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    setError(null);

    const result = await auditedAction(
      {
        actorId: "usr-005", // fixture — replace with session.userId
        actorLabel: FIXTURE_OPS_EMAIL, // fixture
        actorType: "support",
        action: `user.${action}d`,
        workspaceId: "platform",
        resourceType: "user",
        resourceId: userId,
        reason: reason.trim(),
        before: { suspended },
        after: { suspended: !suspended },
      },
      async () => {
        // DEVELOPMENT FIXTURE — replace with real Drizzle UPDATE:
        // await db.update(users).set({ suspended: !suspended }).where(eq(users.id, userId));
        await new Promise<void>((res) => setTimeout(res, 500));
      },
    );

    setLoading(false);
    if (result.ok) {
      setDone(true);
      setOpen(false);
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <Button
        variant={suspended ? "secondary" : "danger"}
        size="sm"
        onClick={() => setOpen(true)}
        disabled={done}
        aria-label={`${action} user ${email}`}
      >
        {done ? (action === "suspend" ? "Suspended" : "Restored") : action === "suspend" ? "Suspend" : "Restore"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "suspend" ? "Suspend" : "Restore"} user
            </DialogTitle>
            <DialogDescription>
              This action will be permanently logged to the audit trail.
              User: <strong>{email}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="suspend-reason">Reason (required)</Label>
              <Textarea
                id="suspend-reason"
                placeholder="e.g. Repeated ToS violations — abuse ticket #1234"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                className="mt-1"
              />
              {error && (
                <p role="alert" className="mt-1 text-sm text-danger">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="secondary" size="sm" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant={action === "suspend" ? "danger" : "primary"}
                size="sm"
                type="submit"
                loading={loading}
                disabled={!reason.trim()}
              >
                {action === "suspend" ? "Suspend user" : "Restore user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
