"use client";

import React from "react";
import { ProgressBar } from "../../../components/onboarding/progress-bar";
import { StepBuilder } from "../../../components/onboarding/step-builder";
import { StepTemplate } from "../../../components/onboarding/step-template";
import { StepDetails } from "../../../components/onboarding/step-details";
import { StepEndpoint } from "../../../components/onboarding/step-endpoint";
import { useWizard } from "../../../components/onboarding/wizard-context";
import { brand } from "@submitpulse/config";
import { cn } from "@submitpulse/ui";

function OnboardingContent() {
  const { state } = useWizard();

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8 sm:px-6 sm:py-12"
      aria-label="Onboarding wizard"
    >
      {/* Brand header */}
      <div className="mb-8 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">
          {brand.name}
        </span>
        <span className="text-xs text-text-muted">
          Set up in under 5 minutes
        </span>
      </div>

      {/* Progress indicator */}
      <div className="mb-8">
        <ProgressBar currentStep={state.step} />
      </div>

      {/* Step content */}
      <div
        className={cn(
          "flex-1 rounded-card border border-border bg-surface p-6 shadow-card sm:p-8",
        )}
      >
        {state.step === 1 && <StepBuilder />}
        {state.step === 2 && <StepTemplate />}
        {state.step === 3 && <StepDetails />}
        {state.step === 4 && <StepEndpoint />}
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return <OnboardingContent />;
}
