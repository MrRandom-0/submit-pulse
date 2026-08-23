import { cn } from "@submitpulse/ui";

interface UsageMeterProps {
  label: string;
  used: number;
  quota: number | null;
  unit?: string;
  className?: string;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

export function UsageMeter({
  label,
  used,
  quota,
  unit = "",
  className,
}: UsageMeterProps) {
  const pct = quota === null ? 0 : Math.min(100, (used / quota) * 100);
  const isWarning = pct >= 80;
  const isDanger = pct >= 95;

  const barColor = isDanger
    ? "bg-danger"
    : isWarning
      ? "bg-warning"
      : "bg-primary";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="text-sm font-medium text-text-primary tabular-nums">
          {formatCount(used)}
          {quota !== null ? (
            <span className="text-text-muted font-regular">
              {" "}
              / {formatCount(quota)}
              {unit ? ` ${unit}` : ""}
            </span>
          ) : (
            <span className="text-text-muted font-regular"> / Unlimited</span>
          )}
        </span>
      </div>
      <div
        className="h-2 w-full bg-surface rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemax={quota ?? used}
        aria-label={`${label} usage`}
      >
        {quota !== null && (
          <div
            className={cn("h-full rounded-full transition-all duration-normal", barColor)}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {isWarning && (
        <p className={cn("text-2xs font-medium", isDanger ? "text-danger" : "text-warning")}>
          {isDanger
            ? "Quota nearly exhausted — upgrade to avoid disruption"
            : "Approaching quota limit"}
        </p>
      )}
    </div>
  );
}
