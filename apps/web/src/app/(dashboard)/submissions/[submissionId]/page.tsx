import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@submitpulse/ui";
import { getSubmission } from "@/lib/dashboard-data";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { PermissionGate } from "@/components/dashboard/PermissionGate";
import type { SubmissionDetail, SpamVerdict, SubmissionStatus } from "@/lib/dashboard-data";

// ---------------------------------------------------------------------------
// SECURITY: Submitted user content is NEVER rendered as HTML.
// All submitted field values are rendered via the renderPlainText() helper
// which converts values to strings and escapes nothing further — because
// React's JSX text nodes are safe-by-default (no dangerouslySetInnerHTML used).
// See OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
//
// DO NOT pass submitted values to dangerouslySetInnerHTML under any circumstances.
// DO NOT interpolate them into HTML strings.
// ---------------------------------------------------------------------------

function FIXTURE_ACTOR(): Actor {
  return { userId: "user-001", workspaceId: "ws-1", role: "admin" };
}

// ---------------------------------------------------------------------------
// Text-only renderer for submitted field values
// SECURITY: This is the single gate for untrusted submitted content.
// Only renders as React text nodes — never as HTML markup.
// ---------------------------------------------------------------------------
function renderSubmittedValue(value: unknown): string {
  // SECURITY NOTE: Convert to plain string only. React renders text nodes safely.
  // Never use dangerouslySetInnerHTML with submitted content.
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // For arrays/objects, render as JSON so the raw structure is visible but safe
  return JSON.stringify(value, null, 2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function spamScoreColor(score: number): string {
  if (score >= 0.8) return "text-danger";
  if (score >= 0.5) return "text-warning";
  return "text-success";
}

const SPAM_BADGE: Record<SpamVerdict, { variant: "danger" | "warning" | "success"; label: string }> = {
  spam: { variant: "danger", label: "Spam" },
  suspect: { variant: "warning", label: "Suspect" },
  clean: { variant: "success", label: "Clean" },
};

const STATUS_BADGE: Record<SubmissionStatus, { variant: "info" | "neutral" | "warning" | "danger" }> = {
  new: { variant: "info" },
  read: { variant: "neutral" },
  archived: { variant: "warning" },
  deleted: { variant: "danger" },
};

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ submissionId: string }>;
}

export default async function SubmissionDetailPage({ params }: PageProps) {
  const { submissionId } = await params;
  const sub: SubmissionDetail | null = await getSubmission(submissionId);
  if (!sub) notFound();

  const actor = FIXTURE_ACTOR();
  const canUpdateStatus = can(actor, "submission:update");
  const canDelete = can(actor, "submission:delete");
  const canExport = can(actor, "submission:export");
  const canRestoreSpam = can(actor, "submission:restore_spam");

  const spamBadge = SPAM_BADGE[sub.spamVerdict];
  const statusBadge = STATUS_BADGE[sub.status];

  const isNew = sub.status === "new" && sub.readAt === null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-text-muted">
          <li><Link href="/submissions" className="hover:text-text-primary">Submissions</Link></li>
          <li aria-hidden>/</li>
          <li className="text-text-primary font-medium font-mono text-xs">{sub.publicId}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {isNew && (
              <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
            )}
            <Badge variant={statusBadge.variant}>{sub.status}</Badge>
            <Badge variant={spamBadge.variant}>{spamBadge.label}</Badge>
            {sub.origin !== "live" && (
              <Badge variant="warning">{sub.origin}</Badge>
            )}
          </div>
          <p className="text-sm text-text-muted mt-2">
            <Link href={`/forms/${sub.formId}`} className="hover:text-primary">
              {sub.formName}
            </Link>
            {" · "}
            <time dateTime={sub.createdAt.toISOString()}>
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "long",
                timeStyle: "medium",
              }).format(sub.createdAt)}
            </time>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canUpdateStatus && (
            <Button variant="secondary" size="sm">
              {sub.status === "archived" ? "Unarchive" : "Archive"}
            </Button>
          )}
          {canRestoreSpam && sub.spamVerdict === "spam" && (
            <Button variant="secondary" size="sm">Not spam</Button>
          )}
          {canUpdateStatus && sub.spamVerdict !== "spam" && (
            <Button variant="secondary" size="sm">Mark spam</Button>
          )}
          {canExport && (
            <Button variant="secondary" size="sm">Export JSON</Button>
          )}
          {canDelete && (
            <Button variant="danger" size="sm">Delete</Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column — main data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submitted fields */}
          <Card className="rounded-card shadow-card">
            <CardHeader>
              <CardTitle>Submitted fields</CardTitle>
              <CardDescription>
                {/* SECURITY: see file-level comment above — values rendered text-only */}
                All values are rendered as plain text only.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {Object.entries(sub.data).map(([key, value]) => (
                <div key={key} className="py-3 first:pt-0 last:pb-0">
                  <dt className="text-xs font-medium text-text-muted uppercase tracking-wide font-mono mb-1">
                    {/* SECURITY: field names come from the schema, not user input, but still rendered as text */}
                    {key}
                  </dt>
                  <dd className="text-sm text-text-primary break-words whitespace-pre-wrap">
                    {/*
                     * SECURITY: renderSubmittedValue() returns a plain string.
                     * React renders this as a text node — NOT as HTML.
                     * Do NOT wrap in <span dangerouslySetInnerHTML> or similar.
                     */}
                    {renderSubmittedValue(value)}
                  </dd>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Unexpected fields (schema drift) */}
          {sub.unexpectedData && Object.keys(sub.unexpectedData).length > 0 && (
            <Card className="rounded-card shadow-card border-warning">
              <CardHeader>
                <CardTitle className="text-warning">Unexpected fields</CardTitle>
                <CardDescription>
                  These fields were submitted but are not in the expected schema. May indicate schema drift.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {Object.entries(sub.unexpectedData).map(([key, value]) => (
                  <div key={key} className="py-3 first:pt-0 last:pb-0">
                    <dt className="text-xs font-medium text-text-muted uppercase tracking-wide font-mono mb-1">
                      {key}
                    </dt>
                    <dd className="text-sm text-text-primary break-words whitespace-pre-wrap">
                      {/*
                       * SECURITY: renderSubmittedValue() — plain text only.
                       * See file-level security comment.
                       */}
                      {renderSubmittedValue(value)}
                    </dd>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Files */}
          {sub.files.length > 0 && (
            <Card className="rounded-card shadow-card">
              <CardHeader>
                <CardTitle>Uploaded files</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {sub.files.map((file) => (
                  <div key={file.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {/* SECURITY: originalFilename is user-supplied — render as text only */}
                        {file.originalFilename}
                      </p>
                      <p className="text-xs text-text-muted">
                        {file.detectedMimeType} · {formatBytes(file.sizeBytes)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={
                          file.scanStatus === "clean"
                            ? "success"
                            : file.scanStatus === "infected"
                              ? "danger"
                              : file.scanStatus === "error"
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {file.scanStatus}
                      </Badge>
                      <PermissionGate actor={actor} permission="file:download">
                        <Button variant="secondary" size="sm">Download</Button>
                      </PermissionGate>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Processing timeline */}
          <Card className="rounded-card shadow-card">
            <CardHeader>
              <CardTitle>Processing timeline</CardTitle>
              {sub.processingMs !== null && (
                <CardDescription>
                  Total: {formatMs(sub.processingMs)}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {sub.events.length === 0 ? (
                <p className="text-sm text-text-muted">No events recorded.</p>
              ) : (
                <ol className="space-y-3">
                  {sub.events.map((ev, i) => (
                    <li key={ev.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary mt-1 flex-shrink-0" aria-hidden />
                        {i < sub.events.length - 1 && (
                          <span className="w-px flex-1 bg-border mt-1" aria-hidden />
                        )}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs font-mono text-text-muted">{ev.kind}</code>
                          {ev.durationMs !== null && (
                            <span className="text-xs text-text-muted tabular-nums">{formatMs(ev.durationMs)}</span>
                          )}
                        </div>
                        {ev.message && (
                          <p className="text-sm text-text-primary mt-0.5">{ev.message}</p>
                        )}
                        <time dateTime={ev.createdAt.toISOString()} className="text-2xs text-text-muted mt-0.5 block">
                          {new Intl.DateTimeFormat("en-US", {
                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                          }).format(ev.createdAt)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="rounded-card shadow-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Internal notes</CardTitle>
              {canUpdateStatus && (
                <Button variant="secondary" size="sm">Add note</Button>
              )}
            </CardHeader>
            <CardContent>
              {sub.notes.length === 0 ? (
                <p className="text-sm text-text-muted">No notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {sub.notes.map((note) => (
                    <div key={note.id} className="rounded-md bg-surface p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-text-secondary">{note.authorName}</span>
                        <time dateTime={note.createdAt.toISOString()} className="text-2xs text-text-muted">
                          {new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(note.createdAt)}
                        </time>
                      </div>
                      <p className="text-sm text-text-primary whitespace-pre-wrap">{note.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — metadata */}
        <div className="space-y-6">
          {/* Spam analysis */}
          <Card className="rounded-card shadow-card">
            <CardHeader>
              <CardTitle>Spam analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Score</span>
                <span className={`text-2xl font-bold tabular-nums ${spamScoreColor(sub.spamScore)}`}>
                  {(sub.spamScore * 100).toFixed(0)}
                  <span className="text-sm font-regular text-text-muted">%</span>
                </span>
              </div>
              <div
                className="h-2 w-full bg-surface rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={sub.spamScore * 100}
                aria-valuemax={100}
                aria-label="Spam score"
              >
                <div
                  className={`h-full rounded-full ${sub.spamScore >= 0.8 ? "bg-danger" : sub.spamScore >= 0.5 ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${sub.spamScore * 100}%` }}
                />
              </div>
              {sub.spamSignals.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Signals</p>
                  {sub.spamSignals.map((sig) => (
                    <div key={sig.code} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary">{sig.label}</p>
                        {sig.evidence !== undefined && (
                          <p className="text-xs text-text-muted">{sig.evidence}</p>
                        )}
                      </div>
                      <span className={`text-xs font-medium tabular-nums flex-shrink-0 ${sig.weight < 0 ? "text-success" : "text-danger"}`}>
                        {sig.weight > 0 ? "+" : ""}{(sig.weight * 100).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery status */}
          <Card className="rounded-card shadow-card">
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Email</span>
                <Badge
                  variant={
                    sub.emailStatus === "sent" ? "success"
                      : sub.emailStatus === "failed" ? "danger"
                        : sub.emailStatus === "pending" ? "warning"
                          : "neutral"
                  }
                >
                  {sub.emailStatus}
                </Badge>
              </div>
              {sub.webhookStatus !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Webhook</span>
                  <Badge
                    variant={
                      sub.webhookStatus === "delivered" ? "success"
                        : sub.webhookStatus === "failed" ? "danger"
                          : sub.webhookStatus === "pending" ? "warning"
                            : "neutral"
                    }
                  >
                    {sub.webhookStatus}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Provenance */}
          <Card className="rounded-card shadow-card">
            <CardHeader>
              <CardTitle>Provenance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: "IP address", value: sub.ipAddress },
                { label: "Country", value: sub.countryCode },
                { label: "Referrer", value: sub.referrer },
                { label: "Origin", value: sub.originHeader },
                { label: "Processing time", value: sub.processingMs !== null ? formatMs(sub.processingMs) : null },
              ].map(({ label, value }) => (
                value !== null && (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="text-text-secondary flex-shrink-0">{label}</span>
                    {/* SECURITY: these values come from server/request metadata, rendered as text */}
                    <span className="text-text-primary text-right font-mono text-xs break-all">{value}</span>
                  </div>
                )
              ))}
            </CardContent>
          </Card>

          {/* User agent */}
          {sub.userAgent && (
            <Card className="rounded-card shadow-card">
              <CardHeader>
                <CardTitle>User agent</CardTitle>
              </CardHeader>
              <CardContent>
                {/* SECURITY: user agent is request metadata, rendered as text — never as HTML */}
                <p className="text-xs text-text-muted font-mono break-all">{sub.userAgent}</p>
              </CardContent>
            </Card>
          )}

          {/* UTM attribution */}
          {(sub.utmSource ?? sub.utmMedium ?? sub.utmCampaign) && (
            <Card className="rounded-card shadow-card">
              <CardHeader>
                <CardTitle>Attribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {[
                  { label: "Source", value: sub.utmSource },
                  { label: "Medium", value: sub.utmMedium },
                  { label: "Campaign", value: sub.utmCampaign },
                  { label: "Term", value: sub.utmTerm },
                  { label: "Content", value: sub.utmContent },
                ].map(({ label, value }) =>
                  value !== null ? (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-text-secondary">{label}</span>
                      {/* SECURITY: UTM values are request parameters, rendered as plain text */}
                      <span className="text-text-primary font-mono text-xs">{value}</span>
                    </div>
                  ) : null,
                )}
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {sub.tags.length > 0 && (
            <Card className="rounded-card shadow-card">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Tags</CardTitle>
                {canUpdateStatus && (
                  <Button variant="secondary" size="sm">Edit tags</Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {sub.tags.map((tag) => (
                    <Badge key={tag} variant="neutral">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assignment */}
          <Card className="rounded-card shadow-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Assignment</CardTitle>
              {canUpdateStatus && (
                <Button variant="secondary" size="sm">Assign</Button>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-muted">
                {sub.assignedToName ?? "Unassigned"}
              </p>
            </CardContent>
          </Card>

          {/* Schema version */}
          {sub.schemaVersionId && (
            <Card className="rounded-card shadow-card">
              <CardHeader>
                <CardTitle>Schema version</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-xs text-text-muted font-mono">{sub.schemaVersionId}</code>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
