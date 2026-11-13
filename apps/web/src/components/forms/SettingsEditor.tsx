"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Input,
  Textarea,
  Label,
  Field,
} from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";
import type { FormDetail } from "@/lib/dashboard-data";
import { EditorFooter, type EditorSaveState } from "./EditorFooter";
import { Toggle } from "./Toggle";

// Mirrors the forms_max_body_sane check (1 KB – 25 MB) with friendly steps.
const MAX_BODY_OPTIONS: Array<{ bytes: number; label: string }> = [
  { bytes: 65_536, label: "64 KB" },
  { bytes: 262_144, label: "256 KB" },
  { bytes: 1_048_576, label: "1 MB" },
  { bytes: 5_242_880, label: "5 MB" },
  { bytes: 26_214_400, label: "25 MB (file uploads)" },
];

interface SettingsEditorProps {
  form: FormDetail;
  canUpdate: boolean;
  canDelete: boolean;
}

export function SettingsEditor({ form, canUpdate, canDelete }: SettingsEditorProps) {
  const [name, setName] = useState(form.name);
  const [websiteUrl, setWebsiteUrl] = useState(form.websiteUrl ?? "");
  const [successMessage, setSuccessMessage] = useState(form.successMessage ?? "");
  const [successRedirectUrl, setSuccessRedirectUrl] = useState(form.successRedirectUrl ?? "");
  const [maxBodyBytes, setMaxBodyBytes] = useState(form.maxBodyBytes);
  const [fileUploadsEnabled, setFileUploadsEnabled] = useState(form.fileUploadsEnabled);
  const [retentionDays, setRetentionDays] = useState<string>(
    form.retentionDaysOverride === null ? "" : String(form.retentionDaysOverride),
  );
  const [saveState, setSaveState] = useState<EditorSaveState>("clean");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleted, setDeleted] = useState(false);

  // The forms table requires redirect targets to be https (forms_redirect_https).
  const redirectInvalid =
    successRedirectUrl.trim() !== "" && !successRedirectUrl.trim().startsWith("https://");
  const retentionInvalid =
    retentionDays.trim() !== "" && (!/^\d+$/.test(retentionDays.trim()) || Number(retentionDays) <= 0);
  const validationError =
    name.trim() === ""
      ? "The form needs a name."
      : redirectInvalid
        ? "Success redirect URL must start with https://."
        : retentionInvalid
          ? "Retention override must be a positive number of days, or empty for the plan default."
          : null;

  function markDirty() {
    setSaveState("dirty");
  }

  function reset() {
    setName(form.name);
    setWebsiteUrl(form.websiteUrl ?? "");
    setSuccessMessage(form.successMessage ?? "");
    setSuccessRedirectUrl(form.successRedirectUrl ?? "");
    setMaxBodyBytes(form.maxBodyBytes);
    setFileUploadsEnabled(form.fileUploadsEnabled);
    setRetentionDays(form.retentionDaysOverride === null ? "" : String(form.retentionDaysOverride));
    setSaveState("clean");
  }

  if (deleted) {
    return (
      <Card className="rounded-card shadow-card">
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm text-text-primary font-medium">
            &quot;{form.name}&quot; deleted.
          </p>
          <p className="text-sm text-text-muted">
            The form and its submissions were removed. This dashboard runs on
            fixture data, so the deletion only applies to this editing session.
          </p>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/forms">Back to forms</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const selectClassName = cn(
    "h-9 rounded-input border border-border bg-surface px-2 text-sm text-text-primary",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  return (
    <div className="space-y-4">
      {/* General */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>How this form is identified and where it lives.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field id="form-name">
            <Label htmlFor="form-name">Form name</Label>
            <Input
              value={name}
              disabled={!canUpdate}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
              invalid={name.trim() === ""}
            />
          </Field>
          <Field id="form-website">
            <Label htmlFor="form-website">Website URL</Label>
            <Input
              value={websiteUrl}
              disabled={!canUpdate}
              onChange={(e) => {
                setWebsiteUrl(e.target.value);
                markDirty();
              }}
              placeholder="https://example.com/contact"
            />
            <p className="text-xs text-text-muted">
              The page this form lives on. Used by the health monitor.
            </p>
          </Field>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-text-secondary">Public ID</span>
            <code className="text-xs text-text-primary font-mono">{form.publicId}</code>
          </div>
        </CardContent>
      </Card>

      {/* After submission */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>After submission</CardTitle>
          <CardDescription>
            What a submitter sees next. A redirect takes precedence over the
            success message for plain HTML form posts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field id="form-success-message">
            <Label htmlFor="form-success-message">Success message</Label>
            <Textarea
              value={successMessage}
              disabled={!canUpdate}
              onChange={(e) => {
                setSuccessMessage(e.target.value);
                markDirty();
              }}
              placeholder="Your submission was received."
              rows={2}
            />
            <p className="text-xs text-text-muted">
              Shown by the embed components after a successful submit. Leave
              empty to use the default message.
            </p>
          </Field>
          <Field id="form-redirect">
            <Label htmlFor="form-redirect">Success redirect URL</Label>
            <Input
              value={successRedirectUrl}
              disabled={!canUpdate}
              onChange={(e) => {
                setSuccessRedirectUrl(e.target.value);
                markDirty();
              }}
              placeholder="https://example.com/thank-you"
              invalid={redirectInvalid}
            />
            {redirectInvalid ? (
              <p role="alert" className="text-xs text-danger">
                Redirect targets must start with https://.
              </p>
            ) : (
              <p className="text-xs text-text-muted">
                Browser form posts are redirected here after a successful submit.
              </p>
            )}
          </Field>
        </CardContent>
      </Card>

      {/* Limits & retention */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Limits &amp; retention</CardTitle>
          <CardDescription>Submission size limits and data retention for this form.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field id="form-max-body">
              <Label htmlFor="form-max-body">Max submission size</Label>
              <select
                value={maxBodyBytes}
                disabled={!canUpdate}
                onChange={(e) => {
                  setMaxBodyBytes(Number(e.target.value));
                  markDirty();
                }}
                className={selectClassName}
              >
                {MAX_BODY_OPTIONS.map((o) => (
                  <option key={o.bytes} value={o.bytes}>
                    {o.label}
                  </option>
                ))}
                {!MAX_BODY_OPTIONS.some((o) => o.bytes === maxBodyBytes) && (
                  <option value={maxBodyBytes}>{maxBodyBytes} bytes (custom)</option>
                )}
              </select>
            </Field>
            <Field id="form-retention">
              <Label htmlFor="form-retention">Retention override (days)</Label>
              <Input
                value={retentionDays}
                disabled={!canUpdate}
                inputMode="numeric"
                onChange={(e) => {
                  setRetentionDays(e.target.value);
                  markDirty();
                }}
                placeholder="Plan default"
                invalid={retentionInvalid}
              />
            </Field>
          </div>
          <Toggle
            id="form-file-uploads"
            label="File uploads"
            description="Accept file fields on this form. Requires a max size that fits the upload."
            checked={fileUploadsEnabled}
            disabled={!canUpdate}
            onChange={(v) => {
              setFileUploadsEnabled(v);
              markDirty();
            }}
          />
        </CardContent>
      </Card>

      {canUpdate && (
        <EditorFooter
          state={saveState}
          validationError={validationError}
          onSave={() => setSaveState("saved")}
          onReset={reset}
        />
      )}

      {/* Danger zone */}
      {canDelete && (
        <Card className="rounded-card shadow-card border-danger">
          <CardHeader>
            <CardTitle className="text-danger">Danger zone</CardTitle>
            <CardDescription>Irreversible actions — proceed with caution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary">Delete this form</p>
                <p className="text-xs text-text-muted">
                  Permanently deletes &quot;{form.name}&quot;, its{" "}
                  {form.submissionCount.toLocaleString("en-US")} submissions, and its
                  notification and domain configuration.
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                Delete form
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirm dialog — requires typing the form name */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteConfirmName("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete form?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{form.name}&quot; and all its
              submissions. This action cannot be undone. Type the form name to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Field id="delete-confirm-name">
              <Label htmlFor="delete-confirm-name">Form name</Label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={form.name}
                autoComplete="off"
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="danger"
              size="sm"
              disabled={deleteConfirmName !== form.name}
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleted(true);
              }}
            >
              Delete form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
