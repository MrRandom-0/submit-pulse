"use client";

/**
 * AgencyBrandingPanel — form for setting agency white-label branding.
 * Fields map to workspaces.branding JSON column (logoUrl, accentColor, replyToEmail).
 * Save is stubbed — replace with a real API call.
 */

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
  Field,
  Button,
} from "@submitpulse/ui";

interface Branding {
  logoUrl: string;
  accentColor: string;
  replyToEmail: string;
}

interface AgencyBrandingPanelProps {
  initial: Partial<Branding>;
}

export function AgencyBrandingPanel({ initial }: AgencyBrandingPanelProps) {
  const [form, setForm] = React.useState<Branding>({
    logoUrl: initial.logoUrl ?? "",
    accentColor: initial.accentColor ?? "#000000",
    replyToEmail: initial.replyToEmail ?? "",
  });
  const [saved, setSaved] = React.useState(false);

  function handleChange(field: keyof Branding) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setSaved(false);
    };
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // TODO: PATCH /api/agency/branding with form data
    setSaved(true);
  }

  const logoId = React.useId();
  const colorId = React.useId();
  const emailId = React.useId();

  return (
    <Card className="rounded-card shadow-card">
      <CardHeader>
        <CardTitle>Agency branding</CardTitle>
        <CardDescription>
          Branding settings apply to white-label client reports. Changes are
          stored in the workspace branding configuration.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSave}>
        <CardContent className="space-y-5">
          <Field>
            <Label htmlFor={logoId}>Logo URL</Label>
            <Input
              id={logoId}
              type="url"
              placeholder="https://example.com/logo.png"
              value={form.logoUrl}
              onChange={handleChange("logoUrl")}
              autoComplete="off"
            />
          </Field>

          <Field>
            <Label htmlFor={colorId}>Accent colour</Label>
            <div className="flex items-center gap-3">
              <input
                id={colorId}
                type="color"
                value={form.accentColor}
                onChange={handleChange("accentColor")}
                className="w-10 h-9 rounded border border-border cursor-pointer bg-surface"
                aria-label="Accent colour picker"
              />
              <Input
                type="text"
                value={form.accentColor}
                onChange={handleChange("accentColor")}
                placeholder="#000000"
                aria-label="Accent colour hex code"
                className="w-32"
              />
            </div>
          </Field>

          <Field>
            <Label htmlFor={emailId}>Reply-to email</Label>
            <Input
              id={emailId}
              type="email"
              placeholder="reports@youragency.com"
              value={form.replyToEmail}
              onChange={handleChange("replyToEmail")}
              autoComplete="email"
            />
          </Field>

          {/* Preview */}
          <div className="rounded-md border border-border p-4 bg-background">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
              Report header preview
            </p>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded border-b-4"
              style={{ borderBottomColor: form.accentColor || "#000" }}
            >
              {form.logoUrl !== "" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logoUrl}
                  alt="Agency logo preview"
                  className="h-8 object-contain"
                />
              ) : (
                <div
                  className="h-8 w-20 rounded bg-surface border border-border flex items-center justify-center"
                  aria-label="Logo placeholder"
                >
                  <span className="text-xs text-text-muted">Logo</span>
                </div>
              )}
              <span className="text-sm font-semibold text-text-primary">
                Monthly Form Health Report
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" variant="primary" size="sm">
            Save branding
          </Button>
          {saved && (
            <span className="text-sm text-success" role="status">
              Saved
            </span>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
