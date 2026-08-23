import { cn } from "@submitpulse/ui";
import type { ActivityEvent } from "@/lib/dashboard-data";

interface ActivityTimelineProps {
  events: ActivityEvent[];
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

const KIND_STYLES: Record<ActivityEvent["kind"], { dot: string; label: string }> = {
  submission_received: { dot: "bg-success", label: "Submission" },
  form_created: { dot: "bg-info", label: "Form created" },
  spam_blocked: { dot: "bg-warning", label: "Spam blocked" },
  health_incident: { dot: "bg-danger", label: "Incident" },
  health_recovered: { dot: "bg-success", label: "Recovered" },
  webhook_failed: { dot: "bg-danger", label: "Webhook failed" },
};

export function ActivityTimeline({ events, className }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-text-muted py-4 text-center">
        No recent activity.
      </p>
    );
  }

  return (
    <ol className={cn("space-y-4", className)}>
      {events.map((event, i) => {
        const style = KIND_STYLES[event.kind];
        return (
          <li key={event.id} className="flex gap-3 items-start">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0",
                  style.dot,
                )}
                aria-hidden
              />
              {i < events.length - 1 && (
                <span className="w-px flex-1 bg-border mt-1" aria-hidden />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-4">
              <p className="text-sm text-text-primary leading-snug">
                {event.message}
              </p>
              {event.formName && (
                <p className="text-xs text-text-muted mt-0.5 truncate">
                  {event.formName}
                </p>
              )}
              <time
                dateTime={event.createdAt.toISOString()}
                className="text-2xs text-text-muted mt-0.5 block"
              >
                {formatRelativeTime(event.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
