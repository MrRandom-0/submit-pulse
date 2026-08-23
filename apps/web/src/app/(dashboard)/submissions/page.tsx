"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Button,
  Badge,
  EmptyState,
  Skeleton,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  useToast,
  cn,
} from "@submitpulse/ui";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { listSubmissions } from "@/lib/dashboard-data";
import { SubmissionRow } from "@/components/dashboard/SubmissionRow";
import { PermissionGate } from "@/components/dashboard/PermissionGate";
import type { SubmissionSummary, SubmissionStatus, SpamVerdict } from "@/lib/dashboard-data";

// ---------------------------------------------------------------------------
// Fixture actor — replace with real session lookup
// ---------------------------------------------------------------------------
const FIXTURE_ACTOR: Actor = {
  userId: "user-001",
  workspaceId: "ws-1",
  role: "admin",
};

// ---------------------------------------------------------------------------
// Bulk action dialog
// ---------------------------------------------------------------------------

type BulkAction = "archive" | "delete" | "mark_spam" | "mark_not_spam" | "export";

interface BulkActionDialogProps {
  action: BulkAction | null;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function BulkActionDialog({ action, count, onConfirm, onCancel }: BulkActionDialogProps) {
  if (!action) return null;

  const labels: Record<BulkAction, { title: string; description: string; confirm: string; variant: "danger" | "primary" }> = {
    archive: { title: "Archive submissions", description: `Archive ${count} submission${count !== 1 ? "s" : ""}?`, confirm: "Archive", variant: "primary" },
    delete: { title: "Delete submissions", description: `Permanently delete ${count} submission${count !== 1 ? "s" : ""}? This cannot be undone.`, confirm: "Delete", variant: "danger" },
    mark_spam: { title: "Mark as spam", description: `Mark ${count} submission${count !== 1 ? "s" : ""} as spam?`, confirm: "Mark spam", variant: "primary" },
    mark_not_spam: { title: "Mark as not spam", description: `Restore ${count} submission${count !== 1 ? "s" : ""} from spam?`, confirm: "Restore", variant: "primary" },
    export: { title: "Export submissions", description: `Export ${count} submission${count !== 1 ? "s" : ""} as CSV?`, confirm: "Export", variant: "primary" },
  };

  const cfg = labels[action];

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" size="sm">Cancel</Button>
          </DialogClose>
          <Button variant={cfg.variant} size="sm" onClick={onConfirm}>
            {cfg.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Submissions inbox (client — needs interactivity for bulk, filters, search)
// ---------------------------------------------------------------------------

export default function SubmissionsPage() {
  const actor = FIXTURE_ACTOR;
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "all">("all");
  const [spamFilter, setSpamFilter] = useState<SpamVerdict | "all">("all");
  const [viewMode, setViewMode] = useState<"list" | "table">("list");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkAction | null>(null);

  // Fixture data (in production: useQuery with server action)
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load fixture data on mount
  if (!loaded) {
    listSubmissions().then((data) => {
      setSubmissions(data);
      setLoaded(true);
    });
  }

  // Apply client-side filters for fixture mode
  const filtered = submissions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (spamFilter !== "all" && s.spamVerdict !== spamFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchFields = s.previewFields.some((f) => f.value.toLowerCase().includes(q));
      const matchForm = s.formName.toLowerCase().includes(q);
      if (!matchFields && !matchForm) return false;
    }
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkConfirm = () => {
    if (!pendingBulkAction) return;
    startTransition(() => {
      // Stub: would call server actions
      const count = selectedIds.size;
      const labels: Record<BulkAction, string> = {
        archive: "archived",
        delete: "deleted",
        mark_spam: "marked as spam",
        mark_not_spam: "restored from spam",
        export: "exported",
      };
      toast({ title: `${count} submission${count !== 1 ? "s" : ""} ${labels[pendingBulkAction]}` });
      setSelectedIds(new Set());
      setPendingBulkAction(null);
    });
  };

  const canDelete = can(actor, "submission:delete");
  const canExport = can(actor, "submission:export");
  const canRestoreSpam = can(actor, "submission:restore_spam");
  const canUpdate = can(actor, "submission:update");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold text-text-primary">Submissions</h1>
          <div className="flex gap-2">
            {/* View mode toggle */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  viewMode === "list"
                    ? "bg-primary text-white"
                    : "bg-background text-text-secondary hover:bg-surface",
                )}
              >
                List
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "table"}
                onClick={() => setViewMode("table")}
                className={cn(
                  "px-3 py-1.5 text-sm border-l border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  viewMode === "table"
                    ? "bg-primary text-white"
                    : "bg-background text-text-secondary hover:bg-surface",
                )}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <label htmlFor="sub-search" className="sr-only">Search submissions</label>
            <input
              id="sub-search"
              type="search"
              placeholder="Search submissions…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full h-9 pl-8 pr-3 text-sm rounded-input border border-border bg-background",
                "text-text-primary placeholder:text-text-muted",
                "focus:outline-none focus:ring-2 focus:ring-focus-ring",
              )}
            />
            <span aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">⌕</span>
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SubmissionStatus | "all")}>
            <SelectTrigger className="w-[130px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={spamFilter} onValueChange={(v) => setSpamFilter(v as SpamVerdict | "all")}>
            <SelectTrigger className="w-[130px]" aria-label="Filter by spam verdict">
              <SelectValue placeholder="Spam" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All verdicts</SelectItem>
              <SelectItem value="clean">Clean</SelectItem>
              <SelectItem value="suspect">Suspect</SelectItem>
              <SelectItem value="spam">Spam</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-surface rounded-md border border-border flex-wrap">
            <span className="text-sm font-medium text-text-primary">
              {selectedIds.size} selected
            </span>
            <div className="flex gap-2 flex-wrap">
              {canUpdate && (
                <Button variant="secondary" size="sm" onClick={() => setPendingBulkAction("archive")}>
                  Archive
                </Button>
              )}
              {canUpdate && (
                <Button variant="secondary" size="sm" onClick={() => setPendingBulkAction("mark_spam")}>
                  Mark spam
                </Button>
              )}
              {canRestoreSpam && (
                <Button variant="secondary" size="sm" onClick={() => setPendingBulkAction("mark_not_spam")}>
                  Not spam
                </Button>
              )}
              {canExport && (
                <Button variant="secondary" size="sm" onClick={() => setPendingBulkAction("export")}>
                  Export
                </Button>
              )}
              {canDelete && (
                <Button variant="danger" size="sm" onClick={() => setPendingBulkAction("delete")}>
                  Delete
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!loaded ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <EmptyState
              title={submissions.length === 0 ? "No submissions yet" : "No matching submissions"}
              description={
                submissions.length === 0
                  ? "Once your forms go live, submissions will appear here."
                  : "Try adjusting your search or filters."
              }
            />
          </div>
        ) : viewMode === "list" ? (
          <div>
            {/* Select all row */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface text-sm text-text-muted">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                aria-label={allSelected ? "Deselect all" : "Select all visible submissions"}
                className="h-4 w-4 rounded border-border text-primary focus:ring-focus-ring"
              />
              <span>{filtered.length} submission{filtered.length !== 1 ? "s" : ""}</span>
            </div>
            {filtered.map((sub) => (
              <SubmissionRow
                key={sub.id}
                submission={sub}
                selected={selectedIds.has(sub.id)}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ) : (
          /* Table view */
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-surface border-b border-border sticky top-0">
                <tr>
                  <th scope="col" className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Select all"
                      className="h-4 w-4 rounded border-border text-primary focus:ring-focus-ring"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Sender</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Form</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Spam</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Received</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => {
                  const previewName = sub.previewFields[0]?.value ?? sub.publicId;
                  const isNew = sub.status === "new" && sub.readAt === null;
                  return (
                    <tr
                      key={sub.id}
                      className={cn(
                        "border-b border-border hover:bg-surface transition-colors",
                        selectedIds.has(sub.id) && "bg-primary/5",
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(sub.id)}
                          onChange={(e) => handleSelect(sub.id, e.target.checked)}
                          aria-label={`Select ${previewName}`}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-focus-ring"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/submissions/${sub.id}`}
                          className={cn(
                            "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm",
                            isNew ? "font-semibold text-text-primary" : "text-text-secondary",
                          )}
                        >
                          {previewName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{sub.formName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={sub.status === "new" ? "info" : sub.status === "archived" ? "warning" : "neutral"}>
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {sub.spamVerdict !== "clean" && (
                          <Badge variant={sub.spamVerdict === "spam" ? "danger" : "warning"}>
                            {sub.spamVerdict}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted tabular-nums text-xs">
                        <time dateTime={sub.createdAt.toISOString()}>
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          }).format(sub.createdAt)}
                        </time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk action confirmation dialog */}
      <BulkActionDialog
        action={pendingBulkAction}
        count={selectedIds.size}
        onConfirm={handleBulkConfirm}
        onCancel={() => setPendingBulkAction(null)}
      />
    </div>
  );
}
