"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { cn } from "@submitpulse/ui";
import { ORDERED_TEMPLATES, type TemplateId, type FormTemplate } from "./templates";
import { useWizard } from "./wizard-context";

interface TemplateCardProps {
  readonly template: FormTemplate;
  readonly selected: boolean;
  readonly onSelect: (id: TemplateId) => void;
  readonly tabIndex: number;
  readonly onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, id: TemplateId) => void;
}

function TemplateCard({
  template,
  selected,
  onSelect,
  tabIndex,
  onKeyDown,
}: TemplateCardProps) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      className={cn(
        "cursor-pointer rounded-card border px-4 py-3 transition-all duration-fast",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        "flex flex-col gap-1 select-none",
        selected
          ? "border-primary bg-primary/10 shadow-sm"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-elevated",
      )}
      onClick={() => onSelect(template.id)}
      onKeyDown={(e) => onKeyDown(e, template.id)}
    >
      <span
        className={cn(
          "text-sm font-medium",
          selected ? "text-text-primary" : "text-text-secondary",
        )}
      >
        {template.label}
      </span>
      <span className="text-xs text-text-muted">{template.description}</span>
      {template.hasFileUpload && (
        <span className="mt-1 text-xs text-info">Supports file uploads</span>
      )}
    </div>
  );
}

export function StepTemplate() {
  const { state, setTemplate, goStep } = useWizard();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const allIds = ORDERED_TEMPLATES.map((t) => t.id) as TemplateId[];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, id: TemplateId) => {
      const idx = allIds.indexOf(id);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = allIds[(idx + 1) % allIds.length];
        if (next) {
          setTemplate(next);
          const cards = document.querySelectorAll('[role="radio"]');
          const nextCard = cards[(idx + 1) % allIds.length] as HTMLElement | undefined;
          nextCard?.focus();
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = allIds[(idx - 1 + allIds.length) % allIds.length];
        if (prev) {
          setTemplate(prev);
          const cards = document.querySelectorAll('[role="radio"]');
          const prevCard = cards[(idx - 1 + allIds.length) % allIds.length] as HTMLElement | undefined;
          prevCard?.focus();
        }
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setTemplate(id);
      }
    },
    [allIds, setTemplate],
  );

  const canContinue = state.templateId !== null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-text-primary focus:outline-none"
        >
          What type of form?
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          We will pre-fill the fields — you can customise them in the next step.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Select a form template"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {ORDERED_TEMPLATES.map((template) => {
          const idx = allIds.indexOf(template.id);
          const isSelected = state.templateId === template.id;
          return (
            <TemplateCard
              key={template.id}
              template={template}
              selected={isSelected}
              onSelect={setTemplate}
              tabIndex={
                state.templateId === null
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

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => goStep(1)}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium text-text-secondary",
            "hover:text-text-primary transition-colors duration-fast",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          )}
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => canContinue && goStep(3)}
          className={cn(
            "rounded-md px-5 py-2 text-sm font-medium transition-all duration-fast",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            canContinue
              ? "bg-primary text-white hover:bg-primary-hover"
              : "cursor-not-allowed bg-surface-elevated text-text-muted",
          )}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
