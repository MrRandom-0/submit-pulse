"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Input } from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";
import type { FormFieldSummary } from "@/lib/dashboard-data";
import { EditorFooter, type EditorSaveState } from "./EditorFooter";

// Mirrors field_type in packages/database/src/schema/enums.ts.
const FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "number",
  "url",
  "date",
  "textarea",
  "select",
  "multiselect",
  "checkbox",
  "hidden",
  "file",
] as const;

// Same rule as the onboarding wizard's field schema.
const NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

interface FieldsEditorProps {
  initialFields: FormFieldSummary[];
  canUpdate: boolean;
}

let newFieldCounter = 0;

export function FieldsEditor({ initialFields, canUpdate }: FieldsEditorProps) {
  const [fields, setFields] = useState<FormFieldSummary[]>(initialFields);
  const [saveState, setSaveState] = useState<EditorSaveState>("clean");

  const validationError = useMemo<string | null>(() => {
    const seen = new Set<string>();
    for (const field of fields) {
      if (field.name.trim() === "") return "Every field needs a name before saving.";
      if (!NAME_PATTERN.test(field.name)) {
        return `Field name "${field.name}" is invalid — use lowercase letters, digits, and underscores, starting with a letter or underscore.`;
      }
      if (seen.has(field.name)) return `Two fields share the name "${field.name}". Field names must be unique.`;
      seen.add(field.name);
    }
    return null;
  }, [fields]);

  function update(id: string, patch: Partial<FormFieldSummary>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setSaveState("dirty");
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      if (!item) return prev;
      next.splice(target, 0, item);
      return next.map((f, i) => ({ ...f, position: i }));
    });
    setSaveState("dirty");
  }

  function remove(id: string) {
    setFields((prev) =>
      prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, position: i })),
    );
    setSaveState("dirty");
  }

  function addField() {
    newFieldCounter += 1;
    setFields((prev) => [
      ...prev,
      {
        id: `ff-new-${newFieldCounter}`,
        name: "",
        label: "",
        type: "text",
        required: false,
        position: prev.length,
        isInternal: false,
        isSensitive: false,
      },
    ]);
    setSaveState("dirty");
  }

  const selectClassName = cn(
    "h-9 rounded-input border border-border bg-surface px-2 text-sm text-text-primary",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  return (
    <div className="space-y-4">
      <Card className="rounded-card shadow-card">
        <CardContent className="pt-6 space-y-3">
          {fields.length === 0 ? (
            <p className="text-sm text-text-muted">
              No fields defined yet. Add the first field below — submissions are
              validated against this list and schema drift is detected from it.
            </p>
          ) : (
            fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-card border border-border bg-background/60 p-3"
              >
                <div className="flex flex-wrap items-end gap-3">
                  {/* Name */}
                  <div className="flex flex-col gap-1.5 min-w-[140px] flex-1">
                    <label
                      htmlFor={`field-name-${field.id}`}
                      className="text-xs font-medium text-text-secondary"
                    >
                      Field name
                    </label>
                    <Input
                      id={`field-name-${field.id}`}
                      value={field.name}
                      disabled={!canUpdate}
                      onChange={(e) => update(field.id, { name: e.target.value })}
                      placeholder="e.g. email"
                      className="font-mono text-xs"
                      aria-invalid={field.name !== "" && !NAME_PATTERN.test(field.name)}
                    />
                  </div>

                  {/* Label */}
                  <div className="flex flex-col gap-1.5 min-w-[140px] flex-1">
                    <label
                      htmlFor={`field-label-${field.id}`}
                      className="text-xs font-medium text-text-secondary"
                    >
                      Label
                    </label>
                    <Input
                      id={`field-label-${field.id}`}
                      value={field.label ?? ""}
                      disabled={!canUpdate}
                      onChange={(e) =>
                        update(field.id, { label: e.target.value === "" ? null : e.target.value })
                      }
                      placeholder="Shown to submitters"
                    />
                  </div>

                  {/* Type */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`field-type-${field.id}`}
                      className="text-xs font-medium text-text-secondary"
                    >
                      Type
                    </label>
                    <select
                      id={`field-type-${field.id}`}
                      value={field.type}
                      disabled={!canUpdate}
                      onChange={(e) => update(field.id, { type: e.target.value })}
                      className={selectClassName}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      {/* Preserve a stored type outside the current enum list. */}
                      {!FIELD_TYPES.includes(field.type as (typeof FIELD_TYPES)[number]) && (
                        <option value={field.type}>{field.type}</option>
                      )}
                    </select>
                  </div>

                  {/* Required */}
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      id={`field-required-${field.id}`}
                      type="checkbox"
                      checked={field.required}
                      disabled={!canUpdate}
                      onChange={(e) => update(field.id, { required: e.target.checked })}
                      className="h-4 w-4 rounded accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <label
                      htmlFor={`field-required-${field.id}`}
                      className="text-xs text-text-secondary"
                    >
                      Required
                    </label>
                  </div>

                  {/* Reorder + remove */}
                  <div className="flex items-center gap-1 pb-1 ml-auto">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={!canUpdate || index === 0}
                      aria-label={`Move ${field.name || "field"} up`}
                      className={cn(
                        "rounded p-1.5 text-text-muted transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                        !canUpdate || index === 0
                          ? "opacity-30 cursor-not-allowed"
                          : "hover:text-text-primary hover:bg-surface-elevated",
                      )}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={!canUpdate || index === fields.length - 1}
                      aria-label={`Move ${field.name || "field"} down`}
                      className={cn(
                        "rounded p-1.5 text-text-muted transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                        !canUpdate || index === fields.length - 1
                          ? "opacity-30 cursor-not-allowed"
                          : "hover:text-text-primary hover:bg-surface-elevated",
                      )}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(field.id)}
                      disabled={!canUpdate}
                      aria-label={`Remove ${field.name || "field"}`}
                      className={cn(
                        "rounded p-1.5 text-text-muted transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                        !canUpdate
                          ? "opacity-30 cursor-not-allowed"
                          : "hover:text-danger hover:bg-surface-elevated",
                      )}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {(field.isInternal || field.isSensitive) && (
                  <div className="flex gap-1 mt-2">
                    {field.isInternal && <Badge variant="warning">Internal</Badge>}
                    {field.isSensitive && <Badge variant="danger">Sensitive</Badge>}
                  </div>
                )}
              </div>
            ))
          )}

          {canUpdate && (
            <div className="pt-1">
              <Button variant="secondary" size="sm" onClick={addField}>
                Add field
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {canUpdate && (
        <EditorFooter
          state={saveState}
          validationError={validationError}
          onSave={() => setSaveState("saved")}
          onReset={() => {
            setFields(initialFields);
            setSaveState("clean");
          }}
        />
      )}
    </div>
  );
}
