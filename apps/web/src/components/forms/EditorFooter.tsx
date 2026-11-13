"use client";

import { Button } from "@submitpulse/ui";

export type EditorSaveState = "clean" | "dirty" | "saved";

interface EditorFooterProps {
  state: EditorSaveState;
  onSave: () => void;
  onReset: () => void;
  saveLabel?: string;
  /** When set (and non-null), saving is blocked and the reason is shown. */
  validationError?: string | null;
}

/**
 * Shared save bar for the form subpage editors. Tracks the editing state
 * locally — the dashboard's data layer is fixture-driven, so "saved" means
 * the editor state was accepted, matching how the rest of the dashboard
 * behaves until the real API wiring lands.
 */
export function EditorFooter({
  state,
  onSave,
  onReset,
  saveLabel = "Save changes",
  validationError = null,
}: EditorFooterProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      {validationError ? (
        <p role="alert" className="text-xs text-danger mr-auto">
          {validationError}
        </p>
      ) : state === "dirty" ? (
        <p className="text-xs text-text-muted mr-auto">You have unsaved changes.</p>
      ) : state === "saved" ? (
        <p className="text-xs text-text-muted mr-auto" role="status">
          Changes saved.
        </p>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        disabled={state === "clean"}
      >
        Reset
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={onSave}
        disabled={state === "clean" || validationError !== null}
      >
        {saveLabel}
      </Button>
    </div>
  );
}
