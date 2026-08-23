import { Card, CardContent, CardHeader, CardTitle } from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";
import type { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
  className?: string;
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  className,
}: MetricCardProps) {
  const trendColor =
    trend?.direction === "up"
      ? "text-success"
      : trend?.direction === "down"
        ? "text-danger"
        : "text-text-muted";

  return (
    <Card className={cn("rounded-card shadow-card", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-text-secondary">
          {title}
        </CardTitle>
        {icon && (
          <span className="text-text-muted" aria-hidden>
            {icon}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-text-primary">
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </div>
        {description && (
          <p className="text-xs text-text-muted mt-1">{description}</p>
        )}
        {trend && (
          <p className={cn("text-xs mt-1 font-medium", trendColor)}>
            {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
