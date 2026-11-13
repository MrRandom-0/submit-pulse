"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../cn";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium rounded transition-all duration-fast ease-standard",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
    "disabled:pointer-events-none disabled:opacity-50",
    "select-none",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-[linear-gradient(180deg,var(--sp-primary),var(--sp-primary-deep))] text-white shadow-sm hover:brightness-[1.08] hover:shadow-md active:opacity-90",
        secondary:
          "bg-surface border border-border text-text-primary shadow-xs hover:bg-background hover:border-border-strong",
        ghost:
          "bg-transparent text-text-secondary hover:bg-background hover:text-text-primary",
        danger:
          "bg-danger text-white hover:opacity-90 active:opacity-80",
      },
      size: {
        sm: "h-7 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading ? true : undefined}
        {...props}
      >
        {asChild ? (
          // Radix Slot contract: with `asChild`, the Slot must receive
          // exactly one React element child so it can clone it with the
          // merged props. Rendering the loading spinner as a sibling
          // expression here hands Slot an array of two children
          // (`false | <Spinner/>` + the child), which Slot rejects with
          // "Slot failed to slot onto its children". So with `asChild`
          // the child element is passed through untouched; the spinner
          // only exists in the real <button> rendering, where there is
          // a host element to contain it.
          children
        ) : (
          <>
            {loading && (
              <Spinner
                size={size === "lg" ? "md" : "sm"}
                aria-hidden="true"
              />
            )}
            {children}
          </>
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";
