"use client";

import Link from "next/link";
import { Badge } from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";
import type { SubmissionSummary, SpamVerdict, SubmissionStatus } from "@/lib/dashboard-data";

interface SubmissionRowProps {
  submission: SubmissionSummary;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  className?: string;
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

const SPAM_BADGE: Record<SpamVerdict, { variant: "danger" | "warning" | "success"; label: string }> = {
  spam: { variant: "danger", label: "Spam" },
  suspect: { variant: "warning", label: "Suspect" },
  clean: { variant: "success", label: "Clean" },
};

const STATUS_BADGE: Record<SubmissionStatus, { variant: "info" | "neutral" | "warning" | "danger"; label: string }> = {
  new: { variant: "info", label: "New" },
  read: { variant: "neutral", label: "Read" },
  archived: { variant: "warning", label: "Archived" },
  deleted: { variant: "danger", label: "Deleted" },
};

export function SubmissionRow({
  submission,
  selected = false,
  onSelect,
  className,
}: SubmissionRowProps) {
  const spam = SPAM_BADGE[submission.spamVerdict];
  const status = STATUS_BADGE[submission.status];
  const isUnread = submission.status === "new" && submission.readAt === null;

  // Preview text: show first field value (name or email) — plain text only
  const previewName = submission.previewFields[0]?.value ?? "";
  const previewEmail =
    submission.previewFields.find((f) => f.name.includes("email"))?.value ?? "";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface transition-colors",
        isUnread && "bg-surface",
        selected && "bg-primary/5",
        className,
      )}
    >
      {onSelect && (
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(submission.id, e.target.checked)}
          aria-label={`Select submission from ${previewName || previewEmail}`}
          className="h-4 w-4 rounded border-border text-primary focus:ring-focus-ring"
        />
      )}

      <Link
        href={`/submissions/${submission.id}`}
        className="flex-1 min-w-0 flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm"
      >
        {/* Unread indicator */}
        <span
          className={cn(
            "h-2 w-2 rounded-full flex-shrink-0",
            isUnread ? "bg-primary" : "bg-transparent",
          )}
          aria-hidden
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-sm truncate", isUnread ? "font-semibold text-text-primary" : "font-regular text-text-secondary")}>
              {previewName || previewEmail || submission.publicId}
            </span>
            {previewName && previewEmail && (
              <span className="text-xs text-text-muted truncate hidden sm:block">
                {previewEmail}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted truncate mt-0.5">
            {submission.formName}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {submission.spamVerdict !== "clean" && (
            <Badge variant={spam.variant}>{spam.label}</Badge>
          )}
          <Badge variant={status.variant}>{status.label}</Badge>
          <time
            dateTime={submission.createdAt.toISOString()}
            className="text-xs text-text-muted tabular-nums hidden sm:block"
          >
            {formatRelativeTime(submission.createdAt)}
          </time>
        </div>
      </Link>
    </div>
  );
}
