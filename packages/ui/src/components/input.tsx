"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../cn";

// ---------------------------------------------------------------------------
// Field context — wires id between Label, Input, and FieldError automatically
// ---------------------------------------------------------------------------

interface FieldContextValue {
  id: string;
  errorId: string;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Provide an explicit id; if omitted a stable one is generated. */
  id?: string;
}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ id: providedId, className, children, ...props }, ref) => {
    const generatedId = React.useId();
    const id = providedId ?? generatedId;
    const errorId = `${id}-error`;

    return (
      <FieldContext.Provider value={{ id, errorId }}>
        <div
          ref={ref}
          className={cn("flex flex-col gap-1.5", className)}
          {...props}
        >
          {children}
        </div>
      </FieldContext.Provider>
    );
  }
);
Field.displayName = "Field";

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, htmlFor, ...props }, ref) => {
  const ctx = useFieldContext();

  return (
    <LabelPrimitive.Root
      ref={ref}
      htmlFor={htmlFor ?? ctx?.id}
      className={cn(
        "text-sm font-medium text-text-primary select-none",
        "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
});
Label.displayName = "Label";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface InputProps extends React.ComponentPropsWithoutRef<"input"> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ invalid = false, className, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const ctx = useFieldContext();
    const resolvedId = id ?? ctx?.id;
    const resolvedDescribedBy =
      ariaDescribedBy ?? (invalid && ctx?.errorId ? ctx.errorId : undefined);

    return (
      <input
        ref={ref}
        id={resolvedId}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={resolvedDescribedBy}
        className={cn(
          "flex h-9 w-full rounded-input bg-surface px-3 py-2",
          "text-sm text-text-primary placeholder:text-text-muted",
          "border transition-colors duration-fast ease-standard",
          invalid
            ? "border-danger focus-visible:ring-danger/40"
            : "border-border focus-visible:ring-focus-ring/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text-primary",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<"textarea"> & { invalid?: boolean }
>(({ invalid = false, className, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
  const ctx = useFieldContext();
  const resolvedId = id ?? ctx?.id;
  const resolvedDescribedBy =
    ariaDescribedBy ?? (invalid && ctx?.errorId ? ctx.errorId : undefined);

  return (
    <textarea
      ref={ref}
      id={resolvedId}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={resolvedDescribedBy}
      className={cn(
        "flex min-h-20 w-full rounded-input bg-surface px-3 py-2 resize-y",
        "text-sm text-text-primary placeholder:text-text-muted",
        "border transition-colors duration-fast ease-standard",
        invalid
          ? "border-danger focus-visible:ring-danger/40"
          : "border-border focus-visible:ring-focus-ring/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-background",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

// ---------------------------------------------------------------------------
// FieldError
// ---------------------------------------------------------------------------

export interface FieldErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const FieldError = React.forwardRef<HTMLParagraphElement, FieldErrorProps>(
  ({ className, id, children, ...props }, ref) => {
    const ctx = useFieldContext();
    return (
      <p
        ref={ref}
        id={id ?? ctx?.errorId}
        role="alert"
        className={cn("text-xs text-danger", className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);
FieldError.displayName = "FieldError";
