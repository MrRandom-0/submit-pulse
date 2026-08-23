"use client";

/**
 * WorkspaceActions — suspend/restore workspace and grant credits.
 * Every action is audited via auditedAction() before mutation.
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
  Input,
} from "@submitpulse/ui";
import type { AdminWorkspace } from "@/lib/admin-data";
import { auditedAction } from "@/components/admin/auditedAction";

interface WorkspaceActionsProps {
  workspace: AdminWorkspace;
}

export function WorkspaceActions({ workspace }: WorkspaceActionsProps) {
  const [dialog, setDialog] = useState<
    "suspend" | "restore" | "credits" | null
  >(null);
  const [reason, setReason] = useState("");
  const [credits, setCredits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSuspend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const result = await auditedAction(
      {
        actorId: "usr-005",
        actorLabel: FIXTURE_OPS_EMAIL,
        actorType: "support",
        action: `workspace.${dialog === "suspend" ? "suspended" : "restored"}`,
        workspaceId: workspace.id,
        resourceType: "workspace",
        resourceId: workspace.id,
        reason: reason.trim(),
        before: { status: workspace.status },
        after: { status: dialog === "suspend" ? "suspended" : "active" },
      },
      async () => {
        // DEVELOPMENT FIXTURE — replace with real Drizzle UPDATE
        await new Promise<void>((res) => setTimeout(res, 400));
      },
    );
    setLoading(false);
    if (result.ok) {
      setDialog(null);
      setReason("");
    } else {
      setError(result.error);
    }
  }

  async function handleCredits(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = parseInt(credits, 10);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a positive integer credit amount.");
      return;
    }
    setLoading(true);
    const result = await auditedAction(
      {
        actorId: "usr-005",
        actorLabel: FIXTURE_OPS_EMAIL,
        actorType: "support",
        action: "credits.granted",
        workspaceId: workspace.id,
        resourceType: "subscription",
        resourceId: workspace.id,
        reason: reason.trim(),
        after: { creditsGranted: amount },
      },
      async () => {
        // DEVELOPMENT FIXTURE — replace with billing API call
        await new Promise<void>((res) => setTimeout(res, 400));
      },
    );
    setLoading(false);
    if (result.ok) {
      setDialog(null);
      setReason("");
      setCredits("");
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        {workspace.status === "active" ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDialog("suspend")}
          >
            Suspend
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDialog("restore")}
          >
            Restore
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialog("credits")}
        >
          Credits
        </Button>
      </div>

      {/* Suspend / Restore dialog */}
      <Dialog
        open={dialog === "suspend" || dialog === "restore"}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            setReason("");
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "suspend" ? "Suspend" : "Restore"} workspace
            </DialogTitle>
            <DialogDescription>
              This action will be audited. Workspace:{" "}
              <strong>{workspace.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSuspend}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="ws-reason">Reason (required)</Label>
              <Textarea
                id="ws-reason"
                rows={3}
                required
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Abuse: 90k submissions in 24 h exceeding plan quota"
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
                variant={dialog === "suspend" ? "danger" : "primary"}
                size="sm"
                loading={loading}
                disabled={!reason.trim()}
                type="submit"
              >
                {dialog === "suspend" ? "Suspend workspace" : "Restore workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Grant credits dialog */}
      <Dialog
        open={dialog === "credits"}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            setReason("");
            setCredits("");
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant submission credits</DialogTitle>
            <DialogDescription>
              Credits will be added to the current billing period for{" "}
              <strong>{workspace.name}</strong>. This action is audited.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCredits} className="space-y-4">
            <div>
              <Label htmlFor="credit-amount">Submission credits</Label>
              <Input
                id="credit-amount"
                type="number"
                min="1"
                required
                value={credits}
                onChange={(e) => {
                  setCredits(e.target.value);
                  setError(null);
                }}
                placeholder="500"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="credit-reason">Reason (required)</Label>
              <Textarea
                id="credit-reason"
                rows={2}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer reported billing issue — support ticket #5678"
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
                variant="primary"
                size="sm"
                loading={loading}
                disabled={!reason.trim() || !credits}
                type="submit"
              >
                Grant credits
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
