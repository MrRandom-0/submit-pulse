import React from "react";
import { WizardProvider } from "../../components/onboarding/wizard-context";

export const metadata = {
  title: "Get started",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WizardProvider>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </WizardProvider>
  );
}
