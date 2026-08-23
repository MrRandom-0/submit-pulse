import * as React from "react";
import { cn } from "../cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ title, description, icon, action, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center",
          "px-8 py-16 gap-4",
          className
        )}
        {...props}
      >
        {icon && (
          <div className="flex items-center justify-center size-12 rounded-md bg-background border border-border text-text-muted mb-2">
            {icon}
          </div>
        )}
        <div className="flex flex-col gap-1.5 max-w-sm">
          <p className="text-base font-semibold text-text-primary">{title}</p>
          {description && (
            <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
          )}
        </div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    );
  }
);

EmptyState.displayName = "EmptyState";
