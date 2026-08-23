"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../cn";

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-4 right-4 z-toast",
      "flex flex-col gap-2 w-full max-w-sm",
      "outline-none",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const toastVariants = cva(
  [
    "group relative flex w-full flex-col gap-1 overflow-hidden",
    "rounded-md border px-4 py-3 shadow-md",
    "transition-all duration-normal ease-standard",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
    "data-[state=open]:slide-in-from-bottom-full",
  ],
  {
    variants: {
      variant: {
        default: "bg-surface border-border text-text-primary",
        success:
          "bg-surface border-success/30 text-text-primary [&_[data-title]]:text-success",
        error:
          "bg-surface border-danger/30 text-text-primary [&_[data-title]]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    VariantProps<typeof toastVariants> {}

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ToastProps
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
));
Toast.displayName = ToastPrimitive.Root.displayName;

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    data-title
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-xs text-text-secondary", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-sm p-0.5 text-text-muted",
      "hover:text-text-primary transition-colors duration-fast",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring",
      "opacity-0 group-hover:opacity-100",
      className
    )}
    toast-close=""
    aria-label="Dismiss"
    {...props}
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </ToastPrimitive.Close>
));
ToastClose.displayName = ToastPrimitive.Close.displayName;

// ---------------------------------------------------------------------------
// useToast hook
// ---------------------------------------------------------------------------

interface ToastOptions {
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
}

interface ToastItem extends ToastOptions {
  id: string;
  open: boolean;
}

interface UseToastReturn {
  toast: (opts: ToastOptions) => void;
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

// Module-level store so the hook stays light — no context needed.
let listeners: Array<(toasts: ToastItem[]) => void> = [];
let toastStore: ToastItem[] = [];

function dispatch(update: ToastItem[]): void {
  toastStore = update;
  listeners.forEach((l) => l(toastStore));
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = React.useState<ToastItem[]>(toastStore);

  React.useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  const toast = React.useCallback((opts: ToastOptions): void => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { ...opts, id, open: true };
    dispatch([...toastStore, item]);
  }, []);

  const dismiss = React.useCallback((id: string): void => {
    dispatch(toastStore.map((t) => (t.id === id ? { ...t, open: false } : t)));
    // Remove from store after animation settles
    setTimeout(() => {
      dispatch(toastStore.filter((t) => t.id !== id));
    }, 300);
  }, []);

  return { toast, toasts, dismiss };
}
