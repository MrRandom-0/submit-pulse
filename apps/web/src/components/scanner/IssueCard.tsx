"use client";

import * as React from "react";
import { Card, CardContent, Badge, CodeBlock } from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";
import type { ScanIssue } from "@submitpulse/scanner";

// ---------------------------------------------------------------------------
// Severity helpers — colour AND icon/text label for accessibility
// ---------------------------------------------------------------------------

type SeverityMeta = {
  badgeVariant: "danger" | "warning" | "neutral";
  label: string;
  /** ASCII icon that does NOT rely on colour alone. */
  icon: string;
};

function severityMeta(severity: ScanIssue["severity"]): SeverityMeta {
  switch (severity) {
    case "Critical":
      return { badgeVariant: "danger", label: "Critical", icon: "✖" };
    case "Warning":
      return { badgeVariant: "warning", label: "Warning", icon: "⚠" };
    case "Improvement":
      return { badgeVariant: "neutral", label: "Improvement", icon: "↑" };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface IssueCardProps {
  issue: ScanIssue;
  defaultOpen?: boolean;
}

export function IssueCard({ issue, defaultOpen = false }: IssueCardProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const meta = severityMeta(issue.severity);
  const triggerId = React.useId();
  const panelId = React.useId();

  return (
    <Card className="rounded-card shadow-card overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full text-left px-5 py-4 flex items-center gap-3",
          "hover:bg-background transition-colors duration-fast",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset",
        )}
      >
        {/* Severity indicator — icon + badge, not colour alone */}
        <span aria-hidden className="text-base shrink-0">
          {meta.icon}
        </span>
        <Badge variant={meta.badgeVariant} size="sm" className="shrink-0">
          {meta.label}
        </Badge>
        <span className="flex-1 font-medium text-sm text-text-primary truncate">
          {issue.title}
        </span>
        {/* Expand/collapse chevron */}
        <span
          aria-hidden
          className={cn(
            "shrink-0 text-text-muted transition-transform duration-fast",
            open ? "rotate-180" : "",
          )}
        >
          ▾
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
        >
          <CardContent className="pt-0 pb-5 space-y-4 border-t border-border">
            {/* Explanation */}
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                Explanation
              </h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                {issue.explanation}
              </p>
            </div>

            {/* Evidence — the literal observed markup */}
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                Evidence observed
              </h4>
              <CodeBlock
                code={issue.evidence}
                language="html"
                copyable
                maxHeight={160}
              />
            </div>

            {/* Recommended fix */}
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                Recommended fix
              </h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                {issue.recommendedFix}
              </p>
            </div>

            {/* AI repair prompt — copyable */}
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                AI repair prompt
              </h4>
              <p className="text-xs text-text-muted mb-2">
                Copy and paste into your AI coding tool to fix this issue automatically.
              </p>
              <CodeBlock
                code={issue.aiRepairPrompt}
                language="prompt"
                copyable
                maxHeight={200}
              />
            </div>
          </CardContent>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Grouped issue list
// ---------------------------------------------------------------------------

interface IssueListProps {
  issues: ScanIssue[];
}

export function IssueList({ issues }: IssueListProps) {
  const grouped = {
    Critical: issues.filter((i) => i.severity === "Critical"),
    Warning: issues.filter((i) => i.severity === "Warning"),
    Improvement: issues.filter((i) => i.severity === "Improvement"),
  };

  const sections: Array<{ label: string; items: ScanIssue[] }> = [
    { label: "Critical", items: grouped.Critical },
    { label: "Warning", items: grouped.Warning },
    { label: "Improvement", items: grouped.Improvement },
  ];

  return (
    <div className="space-y-6">
      {sections.map(({ label, items }) =>
        items.length === 0 ? null : (
          <section key={label} aria-label={`${label} issues`}>
            <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
              <Badge
                variant={
                  label === "Critical"
                    ? "danger"
                    : label === "Warning"
                      ? "warning"
                      : "neutral"
                }
                size="sm"
              >
                {label}
              </Badge>
              <span className="text-text-muted font-normal">
                {items.length} {items.length === 1 ? "issue" : "issues"}
              </span>
            </h3>
            <div className="space-y-2">
              {items.map((issue) => (
                <IssueCard key={issue.code} issue={issue} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
