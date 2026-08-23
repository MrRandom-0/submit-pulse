import { Card, CardContent } from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";

interface AdminMetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  variant?: "default" | "danger" | "warning" | "success";
  icon?: React.ReactNode;
}

export function AdminMetricCard({
  title,
  value,
  description,
  variant = "default",
  icon,
}: AdminMetricCardProps) {
  const variantClass = {
    default: "text-text-primary",
    danger: "text-danger",
    warning: "text-warning",
    success: "text-success",
  }[variant];

  return (
    <Card className="rounded-card shadow-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {title}
          </p>
          {icon && (
            <span className="text-text-muted text-base leading-none" aria-hidden>
              {icon}
            </span>
          )}
        </div>
        <p className={cn("mt-2 text-2xl font-bold tabular-nums", variantClass)}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {description && (
          <p className="mt-1 text-xs text-text-muted">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
