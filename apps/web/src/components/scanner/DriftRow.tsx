"use client";

/**
 * DriftRow — one row in the before/after drift comparison view.
 *
 * Visual distinctions use BOTH icons/text labels AND colour — never colour alone.
 * This satisfies WCAG 1.4.1 (Use of Color).
 */

import * as React from "react";
import {
  Badge,
  Button,
  CodeBlock,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";
import type { DriftEventFixture } from "@/lib/scanner-data";

// ---------------------------------------------------------------------------
// Kind meta — icon + label + colour-class (never ONLY colour)
// ---------------------------------------------------------------------------

type KindMeta = {
  icon: string;
  label: string;
  rowClass: string;
  badgeVariant: "danger" | "warning" | "info" | "neutral";
};

function kindMeta(kind: DriftEventFixture["kind"]): KindMeta {
  switch (kind) {
    case "field_removed":
      return { icon: "−", label: "Removed", rowClass: "bg-danger/5", badgeVariant: "danger" };
    case "field_added":
      return { icon: "+", label: "Added", rowClass: "bg-success/5", badgeVariant: "info" };
    case "field_renamed":
      return { icon: "⇄", label: "Renamed (suggestion)", rowClass: "bg-warning/5", badgeVariant: "warning" };
    case "type_changed":
      return { icon: "≠", label: "Type changed", rowClass: "bg-warning/5", badgeVariant: "warning" };
    case "required_changed":
      return { icon: "!", label: "Required changed", rowClass: "bg-warning/5", badgeVariant: "warning" };
    case "validation_changed":
      return { icon: "~", label: "Validation changed", rowClass: "bg-warning/5", badgeVariant: "warning" };
    case "unexpected_payload":
      return { icon: "?", label: "Unexpected payload", rowClass: "bg-warning/5", badgeVariant: "warning" };
  }
}

function resolutionBadge(resolution: DriftEventFixture["resolution"]) {
  switch (resolution) {
    case "unresolved":
      return <Badge variant="warning" size="sm">Unresolved</Badge>;
    case "accepted":
      return <Badge variant="info" size="sm">Accepted</Badge>;
    case "mapped":
      return <Badge variant="info" size="sm">Mapped</Badge>;
    case "ignored":
      return <Badge variant="neutral" size="sm">Ignored</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Confirm dialog for destructive actions
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{description}</DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            variant={danger ? "danger" : "primary"}
            size="sm"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DriftRow
// ---------------------------------------------------------------------------

interface DriftRowProps {
  event: DriftEventFixture;
  onAccept: (id: string) => void;
  onIgnore: (id: string) => void;
  onMapFields: (id: string) => void;
  onGenerateRepair: (id: string) => void;
}

export function DriftRow({
  event,
  onAccept,
  onIgnore,
  onMapFields,
  onGenerateRepair,
}: DriftRowProps) {
  const meta = kindMeta(event.kind);
  const [showAcceptConfirm, setShowAcceptConfirm] = React.useState(false);
  const [showIgnoreConfirm, setShowIgnoreConfirm] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const panelId = React.useId();
  const triggerId = React.useId();

  const isUnresolved = event.resolution === "unresolved";

  return (
    <div className={cn("rounded-card border border-border overflow-hidden", meta.rowClass)}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Kind icon + label — not colour alone */}
        <span
          aria-hidden
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-surface/80 text-text-primary font-mono font-bold text-base border border-border"
          title={meta.label}
        >
          {meta.icon}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={meta.badgeVariant} size="sm">{meta.label}</Badge>
            {event.fieldName !== null && (
              <code className="text-xs font-mono bg-surface px-1.5 py-0.5 rounded border border-border text-text-primary">
                {event.fieldName}
              </code>
            )}
            {event.kind === "field_renamed" && event.renameConfidenceLabel !== undefined && (
              <span className="text-xs text-text-muted">
                (confidence: {event.renameConfidenceLabel} — suggestion only)
              </span>
            )}
            <span className="text-text-muted text-xs ml-auto">
              {event.occurrenceCount}× observed
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {resolutionBadge(event.resolution)}

          {/* Expand/collapse for before/after details */}
          <button
            id={triggerId}
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((e) => !e)}
            className={cn(
              "p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            )}
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            <span aria-hidden className={cn("block transition-transform duration-fast", expanded ? "rotate-180" : "")}>
              ▾
            </span>
          </button>
        </div>
      </div>

      {/* Before/after columns — expanded */}
      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="border-t border-border"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {/* Before (expected) */}
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Before (expected schema)
              </p>
              {event.previousDefinition !== null ? (
                <CodeBlock
                  code={JSON.stringify(event.previousDefinition, null, 2)}
                  language="json"
                  copyable={false}
                  maxHeight={120}
                />
              ) : (
                <p className="text-sm text-text-muted italic">Not present in expected schema</p>
              )}
            </div>

            {/* After (observed) */}
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                After (observed payload)
              </p>
              {event.observedDefinition !== null ? (
                <CodeBlock
                  code={JSON.stringify(event.observedDefinition, null, 2)}
                  language="json"
                  copyable={false}
                  maxHeight={120}
                />
              ) : (
                <p className="text-sm text-text-muted italic">Not present in observed payload</p>
              )}
            </div>
          </div>

          {/* Repair prompt, if available */}
          {event.aiRepairPrompt !== null && (
            <div className="px-4 pb-4 border-t border-border pt-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                AI repair prompt
              </p>
              <CodeBlock
                code={event.aiRepairPrompt}
                language="prompt"
                copyable
                maxHeight={160}
              />
            </div>
          )}

          {/* Actions — only if unresolved */}
          {isUnresolved && (
            <div className="px-4 pb-4 pt-2 border-t border-border flex flex-wrap gap-2">
              {/* Accept — schema-changing, requires confirm */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAcceptConfirm(true)}
              >
                {meta.icon} Accept change
              </Button>

              {/* Map fields — opens field mapper (stubbed) */}
              {event.kind === "field_renamed" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onMapFields(event.id)}
                >
                  Map fields
                </Button>
              )}

              {/* Generate repair prompt */}
              {event.aiRepairPrompt === null && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onGenerateRepair(event.id)}
                >
                  Generate repair prompt
                </Button>
              )}

              {/* Ignore — non-destructive but confirm for clarity */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowIgnoreConfirm(true)}
              >
                Ignore
              </Button>
            </div>
          )}
        </div>
      )}

      {/*
        SAFETY NOTE: drift is NEVER auto-applied. Accept/Ignore require explicit
        user confirmation through the dialogs below. The application layer must
        enforce this invariant; no schema is mutated without human review.
      */}

      <ConfirmDialog
        open={showAcceptConfirm}
        onOpenChange={setShowAcceptConfirm}
        title="Accept schema change?"
        description={
          `Accepting "${meta.label}" for field "${event.fieldName ?? "(multiple)"}" will ` +
          "create a new schema version. Drift is never auto-applied — you are explicitly " +
          "approving this change. This action cannot be undone automatically."
        }
        confirmLabel="Accept change"
        onConfirm={() => onAccept(event.id)}
      />

      <ConfirmDialog
        open={showIgnoreConfirm}
        onOpenChange={setShowIgnoreConfirm}
        title="Ignore this drift event?"
        description={
          "Ignoring will suppress future alerts for this specific drift pattern. " +
          "No schema changes will be made. You can un-ignore later from the drift log."
        }
        confirmLabel="Ignore"
        onConfirm={() => onIgnore(event.id)}
      />
    </div>
  );
}
