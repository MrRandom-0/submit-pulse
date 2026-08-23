"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Badge,
  StatusDot,
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  useToast,
} from "@submitpulse/ui";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { formEndpoint } from "@submitpulse/config";
import type { FormSummary, HealthStatus } from "@/lib/dashboard-data";
import { CopyEndpoint } from "./CopyEndpoint";

interface FormCardProps {
  form: FormSummary;
  actor: Actor;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function healthToStatus(h: HealthStatus): "healthy" | "degraded" | "failing" | "paused" | "setup_incomplete" {
  return h;
}

export function FormCard({ form, actor }: FormCardProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false);

  const canTest = can(actor, "form:test");
  const canPause = can(actor, "form:pause");
  const canDelete = can(actor, "form:delete");

  const endpoint = formEndpoint(form.publicId);

  const handleDelete = () => {
    // Stub: would call server action to soft-delete the form
    toast({
      title: "Form deleted",
      description: `"${form.name}" has been deleted.`,
    });
    setDeleteDialogOpen(false);
  };

  const handlePause = () => {
    // Stub: would call server action to pause/resume the form
    const next = form.status === "paused" ? "resumed" : "paused";
    toast({
      title: `Form ${next}`,
      description: `"${form.name}" has been ${next}.`,
    });
    setPauseDialogOpen(false);
  };

  const handleTest = async () => {
    if (!canTest) return;
    // Stub: would send a synthetic test submission
    toast({
      title: "Test submission sent",
      description: "Check your notifications for the result.",
    });
  };

  return (
    <>
      <Card className="rounded-card shadow-card flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold text-text-primary truncate">
                <Link
                  href={`/forms/${form.id}`}
                  className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm"
                >
                  {form.name}
                </Link>
              </CardTitle>
              {form.websiteUrl && (
                <p className="text-xs text-text-muted mt-0.5 truncate">
                  {form.websiteUrl}
                </p>
              )}
            </div>
            <StatusDot status={healthToStatus(form.healthStatus)} showLabel />
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={form.status === "active" ? "success" : form.status === "paused" ? "warning" : "neutral"}>
              {form.status}
            </Badge>
            {form.captchaEnabled && (
              <Badge variant="info">CAPTCHA</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-text-muted">Submissions</span>
            <span className="text-text-primary font-medium tabular-nums">
              {form.submissionCount.toLocaleString("en-US")}
            </span>
            <span className="text-text-muted">Spam blocked</span>
            <span className="text-text-primary font-medium tabular-nums">
              {form.spamBlockedCount.toLocaleString("en-US")}
            </span>
            <span className="text-text-muted">Last submission</span>
            <span className="text-text-primary font-medium">
              {form.lastSubmissionAt
                ? formatRelativeTime(form.lastSubmissionAt)
                : "Never"}
            </span>
          </div>
        </CardContent>

        <CardFooter className="gap-2 flex-wrap border-t border-border pt-3">
          <Button variant="primary" size="sm" asChild>
            <Link href={`/forms/${form.id}`}>Open</Link>
          </Button>

          {canTest && (
            <Button variant="secondary" size="sm" onClick={handleTest}>
              Test
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIntegrationDialogOpen(true)}
          >
            Integration
          </Button>

          {canPause && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPauseDialogOpen(true)}
            >
              {form.status === "paused" ? "Resume" : "Pause"}
            </Button>
          )}

          {canDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Copy endpoint inline — always accessible */}
      <div className="mt-2 px-1">
        <CopyEndpoint endpoint={endpoint} />
      </div>

      {/* Integration instructions dialog */}
      <Dialog open={integrationDialogOpen} onOpenChange={setIntegrationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Integration — {form.name}</DialogTitle>
            <DialogDescription>
              Point your HTML form action to this endpoint to start receiving
              submissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <CopyEndpoint endpoint={endpoint} label="Copy endpoint URL" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">Close</Button>
            </DialogClose>
            <Button variant="primary" size="sm" asChild>
              <Link href={`/forms/${form.id}?tab=integration`}>
                Full integration guide
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause confirm dialog */}
      <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.status === "paused" ? "Resume" : "Pause"} form?
            </DialogTitle>
            <DialogDescription>
              {form.status === "paused"
                ? `"${form.name}" will start accepting submissions again.`
                : `"${form.name}" will stop accepting new submissions. Existing submissions are preserved.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">Cancel</Button>
            </DialogClose>
            <Button variant="primary" size="sm" onClick={handlePause}>
              {form.status === "paused" ? "Resume" : "Pause"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete form?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{form.name}&quot; and all its
              submissions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">Cancel</Button>
            </DialogClose>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
