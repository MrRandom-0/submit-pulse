"use client";

/**
 * RequestContentAccess — escalation dialog for viewing submission content.
 *
 * SECURITY DESIGN:
 * ─────────────────────────────────────────────────────────────────────────
 * SUBMISSION CONTENT IS NOT VISIBLE TO ADMINS BY DEFAULT.
 *
 * Admin views show metadata only: counts, timestamps, status, form name.
 * Field values submitted by end-users are NEVER shown without an explicit,
 * reason-logged, time-boxed escalation.
 *
 * This component implements that escalation gate:
 *   1. Operator writes a justification.
 *   2. On submit, an audit_logs entry is written via auditedAction()
 *      with actorType='support', including the written reason and a
 *      time-boxed expiry (CONTENT_ACCESS_TTL_MINUTES).
 *   3. Only after the audit write succeeds is the content revealed.
 *   4. The reveal is scoped to this session and expires after TTL.
 *
 * Audit entry action name: 'submission_content.accessed'
 * Required fields in audit metadata: reason, submissionId, expiresAt
 * ─────────────────────────────────────────────────────────────────────────
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
  Badge,
} from "@submitpulse/ui";

/** Minutes before access grant expires and content is re-hidden. */
const CONTENT_ACCESS_TTL_MINUTES = 30;

interface RequestContentAccessProps {
  submissionId: string;
  formName: string;
  onAccessGranted: (expiresAt: Date) => void;
}

export function RequestContentAccess({
  submissionId,
  formName,
  onAccessGranted,
}: RequestContentAccessProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (reason.trim().length < 20) {
      setError("Please provide a detailed justification (at least 20 characters).");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // DEVELOPMENT FIXTURE: In production this calls a server action that
      // invokes auditedAction() with action='submission_content.accessed'
      // and persists to audit_logs before revealing content.
      await new Promise<void>((resolve) => setTimeout(resolve, 600));

      const expiresAt = new Date(
        Date.now() + CONTENT_ACCESS_TTL_MINUTES * 60 * 1000,
      );

      console.log("[AUDIT — CONTENT ACCESS]", {
        action: "submission_content.accessed",
        actorType: "support",
        submissionId,
        formName,
        reason: reason.trim(),
        expiresAt: expiresAt.toISOString(),
      });

      setOpen(false);
      setReason("");
      onAccessGranted(expiresAt);
    } catch {
      setError("Failed to log access request. Content cannot be revealed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Request content access for submission ${submissionId}`}
      >
        <span aria-hidden>🔓</span> Request content access
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="warning">Sensitive</Badge>
              Request Submission Content Access
            </DialogTitle>
            <DialogDescription>
              Submission field values are hidden from admin views by default.
              This escalation will be logged to the audit trail with your
              justification. Access expires after{" "}
              <strong>{CONTENT_ACCESS_TTL_MINUTES} minutes</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
              <strong>Audit notice:</strong> Your access to the content of
              submission <code className="font-mono">{submissionId}</code> on
              form <strong>{formName}</strong> will be permanently recorded
              with your name, IP address, timestamp, and the reason below.
            </div>

            <div>
              <Label htmlFor="access-reason">
                Justification <span aria-hidden>(required)</span>
              </Label>
              <Textarea
                id="access-reason"
                placeholder="e.g. Customer support ticket #1234 — customer cannot locate their submission and has provided consent to review."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                rows={4}
                required
                aria-describedby={error ? "access-reason-error" : undefined}
                className="mt-1"
              />
              {error && (
                <p
                  id="access-reason-error"
                  role="alert"
                  className="mt-1 text-sm text-danger"
                >
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
                variant="danger"
                size="sm"
                type="submit"
                loading={loading}
                disabled={reason.trim().length < 20}
              >
                Log access and reveal content
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
