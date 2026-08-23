"use client";

import React from "react";
import { cn } from "@submitpulse/ui";
import type { WizardStep } from "./wizard-context";

const STEPS: { readonly step: WizardStep; readonly label: string }[] = [
  { step: 1, label: "Builder" },
  { step: 2, label: "Template" },
  { step: 3, label: "Details" },
  { step: 4, label: "Endpoint" },
];

interface ProgressBarProps {
  readonly currentStep: WizardStep;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="flex items-center justify-between gap-1 sm:gap-2">
        {STEPS.map(({ step, label }, index) => {
          const isComplete = step < currentStep;
          const isCurrent = step === currentStep;
          const isPending = step > currentStep;

          return (
            <React.Fragment key={step}>
              <li
                aria-current={isCurrent ? "step" : undefined}
                className="flex flex-col items-center gap-1 min-w-0"
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-normal",
                    isComplete && "bg-primary text-white",
                    isCurrent && "border-2 border-primary bg-primary/10 text-primary",
                    isPending && "border-2 border-border bg-surface text-text-muted",
                  )}
                  aria-hidden
                >
                  {isComplete ? (
                    <span>✓</span>
                  ) : (
                    <span>{step}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-2xs hidden sm:block truncate max-w-16 text-center",
                    isCurrent && "font-medium text-text-primary",
                    isComplete && "text-text-secondary",
                    isPending && "text-text-muted",
                  )}
                >
                  {label}
                </span>
              </li>
              {index < STEPS.length - 1 && (
                <li
                  className={cn(
                    "flex-1 h-px transition-colors duration-normal",
                    step < currentStep ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
      {/* Screen reader only live announcement */}
      <p className="sr-only" aria-live="polite">
        Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1]?.label}
      </p>
    </nav>
  );
}
