"use client";

import { Label } from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";

interface ToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * Labelled on/off row used across the form subpage editors. Follows the
 * dashboard's existing checkbox treatment (accent-coloured native input)
 * rather than introducing a new switch component.
 */
export function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className={cn(disabled && "opacity-50")}>
          {label}
        </Label>
        {description && (
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        )}
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 mt-0.5 shrink-0 rounded accent-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
