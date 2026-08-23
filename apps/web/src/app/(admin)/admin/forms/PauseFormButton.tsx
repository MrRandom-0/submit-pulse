"use client";

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

interface PauseFormButtonProps {
  formId: string;
  formName: string;
  workspaceId: string;
  paused: boolean;
}

export function PauseFormButton({
  formId,
  formName,
  workspaceId,
  paused,
}: PauseFormButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const result = await auditedAction(
      {
        actorId: "usr-005",
        actorLabel: FIXTURE_OPS_EMAIL,
        actorType: "support",
        action: paused ? "form.unpaused" : "form.paused",
        workspaceId,
        resourceType: "form",
        resourceId: formId,
        reason: reason.trim(),
        before: { status: paused ? "paused" : "active" },
        after: { status: paused ? "active" : "paused" },
      },
      async () => {
        // DEVELOPMENT FIXTURE — replace with real Drizzle UPDATE
        await new Promise<void>((res) => setTimeout(res, 400));
      },
    );
    setLoading(false);
    if (result.ok) {
      setDone(true);
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        variant={paused ? "secondary" : "danger"}
        size="sm"
        onClick={() => setOpen(true)}
        disabled={done}
      >
        {done ? "Done" : paused ? "Unpause" : "Pause"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{paused ? "Unpause" : "Pause"} form</DialogTitle>
            <DialogDescription>
              <strong>{formName}</strong> — this action is audited.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pause-reason">Reason (required)</Label>
              <Textarea
                id="pause-reason"
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Abuse detected — pausing pending workspace review"
                className="mt-1"
              />
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="secondary" size="sm" type="button">Cancel</Button>
              </DialogClose>
              <Button
                variant={paused ? "primary" : "danger"}
                size="sm"
                loading={loading}
                disabled={!reason.trim()}
                type="submit"
              >
                {paused ? "Unpause form" : "Pause form"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
