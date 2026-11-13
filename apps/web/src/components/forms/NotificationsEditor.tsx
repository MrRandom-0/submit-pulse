"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  Input,
} from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";
import type {
  EmailDestinationSummary,
  FormNotificationSettings,
} from "@/lib/dashboard-data";
import { EditorFooter, type EditorSaveState } from "./EditorFooter";
import { Toggle } from "./Toggle";

interface NotificationsEditorProps {
  initial: FormNotificationSettings;
  /** Names of the form's non-internal fields, for the Reply-To picker. */
  fieldNames: string[];
  canManage: boolean;
}

let newDestinationCounter = 0;

// Basic shape check; full validation happens server-side (schema check is
// the same position('@') rule the database enforces).
function looksLikeEmail(value: string): boolean {
  const at = value.indexOf("@");
  return at > 0 && value.includes(".", at) && !value.includes(" ");
}

export function NotificationsEditor({
  initial,
  fieldNames,
  canManage,
}: NotificationsEditorProps) {
  const [notifyOnSubmission, setNotifyOnSubmission] = useState(initial.notifyOnSubmission);
  const [destinations, setDestinations] = useState<EmailDestinationSummary[]>(initial.destinations);
  const [saveState, setSaveState] = useState<EditorSaveState>("clean");
  const [newEmail, setNewEmail] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  function markDirty() {
    setSaveState("dirty");
  }

  function update(id: string, patch: Partial<EmailDestinationSummary>) {
    setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    markDirty();
  }

  function remove(id: string) {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
    markDirty();
  }

  function addDestination() {
    const email = newEmail.trim().toLowerCase();
    if (!looksLikeEmail(email)) {
      setAddError("Enter a valid email address.");
      return;
    }
    if (destinations.some((d) => d.email === email)) {
      setAddError(`${email} is already a recipient.`);
      return;
    }
    newDestinationCounter += 1;
    setDestinations((prev) => [
      ...prev,
      {
        id: `ed-new-${newDestinationCounter}`,
        email,
        label: null,
        // New addresses start unverified: a confirmation email is sent and
        // the address only receives submissions once confirmed.
        verified: false,
        enabled: true,
        replyToFieldName: null,
      },
    ]);
    setNewEmail("");
    setAddError(null);
    markDirty();
  }

  const selectClassName = cn(
    "h-9 rounded-input border border-border bg-surface px-2 text-sm text-text-primary",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  return (
    <div className="space-y-4">
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Email notifications</CardTitle>
          <CardDescription>
            Recipients get a copy of every non-spam submission for this form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Toggle
            id="notify-on-submission"
            label="Notify on new submissions"
            description={
              notifyOnSubmission
                ? "On — recipients below are emailed for each new submission."
                : "Off — submissions are stored but nobody is emailed."
            }
            checked={notifyOnSubmission}
            disabled={!canManage}
            onChange={(v) => {
              setNotifyOnSubmission(v);
              markDirty();
            }}
          />

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium text-text-primary">Recipients</p>
            {destinations.length === 0 ? (
              <EmptyState
                title="No recipients yet"
                description="Add an email address to start receiving submission notifications."
              />
            ) : (
              destinations.map((d) => (
                <div
                  key={d.id}
                  className="rounded-card border border-border bg-background/60 p-3 space-y-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{d.email}</span>
                    {d.verified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="warning">Pending verification</Badge>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <label
                        htmlFor={`dest-enabled-${d.id}`}
                        className="text-xs text-text-secondary"
                      >
                        Enabled
                      </label>
                      <input
                        id={`dest-enabled-${d.id}`}
                        type="checkbox"
                        checked={d.enabled}
                        disabled={!canManage}
                        onChange={(e) => update(d.id, { enabled: e.target.checked })}
                        className="h-4 w-4 rounded accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canManage}
                        onClick={() => remove(d.id)}
                        aria-label={`Remove ${d.email}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex flex-col gap-1.5 min-w-[180px] flex-1">
                      <label
                        htmlFor={`dest-label-${d.id}`}
                        className="text-xs font-medium text-text-secondary"
                      >
                        Label
                      </label>
                      <Input
                        id={`dest-label-${d.id}`}
                        value={d.label ?? ""}
                        disabled={!canManage}
                        onChange={(e) =>
                          update(d.id, { label: e.target.value === "" ? null : e.target.value })
                        }
                        placeholder="e.g. Sales team"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`dest-replyto-${d.id}`}
                        className="text-xs font-medium text-text-secondary"
                      >
                        Reply-To field
                      </label>
                      <select
                        id={`dest-replyto-${d.id}`}
                        value={d.replyToFieldName ?? ""}
                        disabled={!canManage}
                        onChange={(e) =>
                          update(d.id, {
                            replyToFieldName: e.target.value === "" ? null : e.target.value,
                          })
                        }
                        className={selectClassName}
                      >
                        <option value="">None</option>
                        {fieldNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-text-muted">
                        Replies to the notification go to this field&rsquo;s value.
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}

            {canManage && (
              <div className="pt-1">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      value={newEmail}
                      onChange={(e) => {
                        setNewEmail(e.target.value);
                        setAddError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addDestination();
                        }
                      }}
                      placeholder="name@example.com"
                      aria-label="New recipient email"
                      invalid={addError !== null}
                    />
                  </div>
                  <Button variant="secondary" size="md" onClick={addDestination}>
                    Add recipient
                  </Button>
                </div>
                {addError && (
                  <p role="alert" className="text-xs text-danger mt-1.5">
                    {addError}
                  </p>
                )}
                <p className="text-xs text-text-muted mt-1.5">
                  New recipients must confirm their address before submissions are sent to them.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <EditorFooter
          state={saveState}
          onSave={() => setSaveState("saved")}
          onReset={() => {
            setNotifyOnSubmission(initial.notifyOnSubmission);
            setDestinations(initial.destinations);
            setSaveState("clean");
          }}
        />
      )}
    </div>
  );
}
