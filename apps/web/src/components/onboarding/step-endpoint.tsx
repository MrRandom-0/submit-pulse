"use client";

import React, { useRef, useEffect, useState, useCallback, useId } from "react";
import {
  formEndpoint,
  generateIntegrationPrompt,
  BUILDERS,
  ONBOARDING_BUILDER_IDS,
  type BuilderId,
} from "@submitpulse/config";
import { cn } from "@submitpulse/ui";
import { useWizard, type FormField } from "./wizard-context";
import type { FormFieldSpec } from "@submitpulse/config";

function fieldToSpec(f: FormField): FormFieldSpec {
  return {
    name: f.name,
    type: f.type,
    required: f.required,
    label: f.label,
  };
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: silently fail — the user can still copy manually
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        "rounded px-2 py-1 text-xs font-medium transition-all duration-fast",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        copied
          ? "bg-success/20 text-success"
          : "bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface",
      )}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

interface CodePanelProps {
  readonly code: string;
  readonly language?: string;
  readonly caption?: string;
  readonly copyLabel: string;
}

function CodePanel({ code, language = "text", caption, copyLabel }: CodePanelProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {caption && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-muted">{caption}</span>
          <CopyButton text={code} label={copyLabel} />
        </div>
      )}
      <pre
        className={cn(
          "overflow-x-auto rounded-card border border-border bg-code-background",
          "px-4 py-3 text-xs font-mono text-text-primary leading-relaxed",
          "max-h-64 whitespace-pre-wrap break-words",
        )}
        tabIndex={0}
        aria-label={caption ?? "Code"}
      >
        <code>{code}</code>
      </pre>
      {!caption && (
        <div className="flex justify-end">
          <CopyButton text={code} label={copyLabel} />
        </div>
      )}
    </div>
  );
}

export function StepEndpoint() {
  const { state } = useWizard();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [activeBuilderId, setActiveBuilderId] = useState<BuilderId>(
    state.builderId ?? "html",
  );
  const switcherId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const endpoint = formEndpoint(state.publicFormId);

  const integrationPrompt = generateIntegrationPrompt({
    formName: state.formName || "My Form",
    publicFormId: state.publicFormId,
    endpoint,
    fields: state.fields.map(fieldToSpec),
    allowedOrigin: state.allowedDomain || null,
    captchaEnabled: false,
    hasFileUpload: state.fields.some((f) => f.type === "file"),
    builder: activeBuilderId,
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Heading */}
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-text-primary focus:outline-none"
        >
          Your form is ready
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Copy the prompt below and paste it into your AI tool.
        </p>
      </div>

      {/* Backend warning — honest about stub */}
      {state.backendWarning && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-card border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-text-primary"
        >
          <span className="font-medium">Note: </span>
          {state.backendWarning}
        </div>
      )}

      {/* Endpoint */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-text-primary">
          Your submission endpoint
        </h3>
        <CodePanel
          code={endpoint}
          language="text"
          caption="POST to this URL from your form"
          copyLabel="Copy endpoint URL"
        />
        <p className="text-xs text-text-muted">
          This endpoint ID is public and is not a secret — it should be. Abuse
          protection comes from your domain rules (allowed origin) and bot
          protection, not from keeping this URL hidden.
        </p>
      </div>

      {/* Builder switcher */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            AI integration prompt
          </h3>
          <div className="flex items-center gap-2">
            <label htmlFor={switcherId} className="text-xs text-text-secondary sr-only">
              Builder
            </label>
            <select
              id={switcherId}
              value={activeBuilderId}
              onChange={(e) => setActiveBuilderId(e.target.value as BuilderId)}
              aria-label="Regenerate prompt for a different tool"
              className={cn(
                "rounded-input border border-border bg-background px-2 py-1 text-xs text-text-primary",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              )}
            >
              {ONBOARDING_BUILDER_IDS.map((id) => (
                <option key={id} value={id}>
                  {BUILDERS[id]?.label ?? id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-text-muted">
          Paste this into {BUILDERS[activeBuilderId]?.label ?? activeBuilderId} to
          wire up your form. It contains no secrets or credentials.
        </p>

        <CodePanel
          code={integrationPrompt}
          language="text"
          copyLabel="Copy AI integration prompt"
        />
      </div>

      {/* Waiting state */}
      <div className="rounded-card border border-border bg-surface px-5 py-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full bg-warning animate-pulse"
            aria-hidden
          />
          <h3 className="text-sm font-semibold text-text-primary">
            Waiting for your first submission
          </h3>
        </div>
        <p className="text-sm text-text-secondary">
          To see your first submission arrive:
        </p>
        <ol className="list-decimal list-inside flex flex-col gap-1.5 text-sm text-text-secondary">
          <li>Copy the AI prompt above.</li>
          <li>
            Paste it into{" "}
            <span className="font-medium text-text-primary">
              {BUILDERS[activeBuilderId]?.label ?? activeBuilderId}
            </span>
            .
          </li>
          <li>Let the tool wire up your form to the endpoint.</li>
          <li>Submit your form once to verify it works.</li>
          <li>
            Come back here — your first submission will appear in the dashboard.
          </li>
        </ol>
      </div>

      {/* Dashboard link stub */}
      <div className="flex justify-between items-center pt-2">
        <span className="text-xs text-text-muted">
          Your form ID: <code className="font-mono">{state.publicFormId}</code>
        </span>
        <a
          href="/overview"
          className={cn(
            "rounded-md px-5 py-2 text-sm font-medium bg-primary text-white",
            "hover:bg-primary-hover transition-colors duration-fast",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          )}
        >
          Go to dashboard
        </a>
      </div>
    </div>
  );
}
