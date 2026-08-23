"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { ONBOARDING_BUILDER_IDS, BUILDERS, type BuilderId } from "@submitpulse/config";
import { cn } from "@submitpulse/ui";
import { useWizard } from "./wizard-context";

const CATEGORY_LABELS: Record<string, string> = {
  ai_builder: "AI builders",
  ai_ide: "AI coding tools",
  visual: "Visual editors",
  framework: "Frameworks",
  other: "Other",
};

interface BuilderCardProps {
  readonly builderId: BuilderId;
  readonly selected: boolean;
  readonly onSelect: (id: BuilderId) => void;
  readonly tabIndex: number;
  readonly onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, id: BuilderId) => void;
}

function BuilderCard({ builderId, selected, onSelect, tabIndex, onKeyDown }: BuilderCardProps) {
  const profile = BUILDERS[builderId] ?? { label: builderId };
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      className={cn(
        "cursor-pointer rounded-card border px-4 py-3 transition-all duration-fast",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        "flex flex-col gap-1 select-none",
        selected
          ? "border-primary bg-primary/10 text-text-primary shadow-sm"
          : "border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-elevated hover:text-text-primary",
      )}
      onClick={() => onSelect(builderId)}
      onKeyDown={(e) => onKeyDown(e, builderId)}
    >
      <span className="text-sm font-medium">{profile.label}</span>
    </div>
  );
}

export function StepBuilder() {
  const { state, setBuilder, goStep } = useWizard();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Group builders by category in order
  const grouped = ONBOARDING_BUILDER_IDS.reduce<
    Array<{ category: string; ids: BuilderId[] }>
  >((acc, id) => {
    const profile = BUILDERS[id] as (typeof BUILDERS)[BuilderId] | undefined;
    if (!profile) return acc;
    const last = acc[acc.length - 1];
    if (last && last.category === profile.category) {
      last.ids.push(id);
    } else {
      acc.push({ category: profile.category, ids: [id] });
    }
    return acc;
  }, []);

  const allIds = ONBOARDING_BUILDER_IDS as readonly BuilderId[];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, id: BuilderId) => {
      const idx = allIds.indexOf(id);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = allIds[(idx + 1) % allIds.length];
        if (next) {
          setBuilder(next);
          // Focus the next card
          const cards = document.querySelectorAll('[role="radio"]');
          const nextCard = cards[(idx + 1) % allIds.length] as HTMLElement | undefined;
          nextCard?.focus();
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = allIds[(idx - 1 + allIds.length) % allIds.length];
        if (prev) {
          setBuilder(prev);
          const cards = document.querySelectorAll('[role="radio"]');
          const prevCard = cards[(idx - 1 + allIds.length) % allIds.length] as HTMLElement | undefined;
          prevCard?.focus();
        }
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setBuilder(id);
      }
    },
    [allIds, setBuilder],
  );

  const canContinue = state.builderId !== null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-text-primary focus:outline-none"
        >
          What are you building with?
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          We will generate an integration prompt that works with your tool.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Select your builder or framework"
        className="flex flex-col gap-6"
      >
        {grouped.map((group) => (
          <div key={group.category} className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {CATEGORY_LABELS[group.category] ?? group.category}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {group.ids.map((id) => {
                const idx = allIds.indexOf(id);
                const isSelected = state.builderId === id;
                return (
                  <BuilderCard
                    key={id}
                    builderId={id}
                    selected={isSelected}
                    onSelect={setBuilder}
                    tabIndex={
                      state.builderId === null
                        ? idx === 0
                          ? 0
                          : -1
                        : isSelected
                        ? 0
                        : -1
                    }
                    onKeyDown={handleKeyDown}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => canContinue && goStep(2)}
          className={cn(
            "rounded-md px-5 py-2 text-sm font-medium transition-all duration-fast",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            canContinue
              ? "bg-primary text-white hover:bg-primary-hover"
              : "cursor-not-allowed bg-surface-elevated text-text-muted",
          )}
          aria-label={canContinue ? "Continue to step 2" : "Select a builder to continue"}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
