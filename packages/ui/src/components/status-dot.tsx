import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../cn";

const dotVariants = cva("rounded-full shrink-0", {
  variants: {
    status: {
      healthy:          "bg-success",
      degraded:         "bg-warning",
      failing:          "bg-danger",
      paused:           "bg-text-muted",
      setup_incomplete: "bg-info",
    },
    size: {
      sm: "size-1.5",
      md: "size-2",
    },
  },
  defaultVariants: {
    status: "healthy",
    size: "md",
  },
});

const statusLabels: Record<NonNullable<VariantProps<typeof dotVariants>["status"]>, string> = {
  healthy:          "Healthy",
  degraded:         "Degraded",
  failing:          "Failing",
  paused:           "Paused",
  setup_incomplete: "Setup incomplete",
};

export interface StatusDotProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  status: NonNullable<VariantProps<typeof dotVariants>["status"]>;
  showLabel?: boolean;
  size?: NonNullable<VariantProps<typeof dotVariants>["size"]>;
}

export const StatusDot = React.forwardRef<HTMLSpanElement, StatusDotProps>(
  ({ status, showLabel = false, size, className, ...props }, ref) => {
    const label = statusLabels[status];

    return (
      <span
        ref={ref}
        className={cn("inline-flex items-center gap-1.5", className)}
        {...props}
      >
        <span
          className={cn(dotVariants({ status, size }))}
          aria-hidden="true"
        />
        <span className={cn(showLabel ? "text-sm text-text-secondary" : "sr-only")}>
          {label}
        </span>
      </span>
    );
  }
);

StatusDot.displayName = "StatusDot";
