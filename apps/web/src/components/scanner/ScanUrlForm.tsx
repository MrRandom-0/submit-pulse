"use client";

import * as React from "react";
import { Button, Input, Field, FieldError } from "@submitpulse/ui";

interface ScanUrlFormProps {
  onScan: (url: string) => void;
  loading: boolean;
}

export function ScanUrlForm({ onScan, loading }: ScanUrlFormProps) {
  const [url, setUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const inputId = React.useId();
  const errorId = React.useId();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a URL to scan.");
      return;
    }
    if (!trimmed.startsWith("https://")) {
      setError("Only HTTPS URLs are allowed. The scanner blocks non-HTTPS and private addresses.");
      return;
    }
    onScan(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field>
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          Page URL to scan
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            type="url"
            placeholder="https://example.com/contact"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            aria-invalid={error !== null ? true : undefined}
            aria-describedby={error !== null ? errorId : undefined}
            autoComplete="url"
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
          >
            {loading ? "Scanning…" : "Scan"}
          </Button>
        </div>
        {error !== null && (
          <FieldError id={errorId} className="mt-1.5">
            {error}
          </FieldError>
        )}
        <p className="text-xs text-text-muted mt-1.5">
          The scanner fetches the page server-side. Private/internal addresses are blocked.
        </p>
      </Field>
    </form>
  );
}
