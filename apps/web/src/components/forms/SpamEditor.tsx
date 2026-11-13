"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  Input,
  Label,
  Field,
} from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";
import type {
  FormSpamSettings,
  SpamRuleKind,
  SpamRuleSummary,
  SpamSensitivity,
} from "@/lib/dashboard-data";
import { EditorFooter, type EditorSaveState } from "./EditorFooter";
import { Toggle } from "./Toggle";

// Rule kinds mirror the SpamRule union in apps/ingest/src/pipeline/spam-rules.ts.
const RULE_KINDS: Array<{ value: SpamRuleKind; label: string }> = [
  { value: "blocklist_term", label: "Blocked term" },
  { value: "blocklist_email", label: "Blocked email / domain" },
  { value: "blocklist_ip", label: "Blocked IP" },
  { value: "allowlist_email", label: "Allowed email / domain" },
  { value: "regex", label: "Regex pattern" },
];

const SENSITIVITY_OPTIONS: Array<{
  value: SpamSensitivity;
  label: string;
  description: string;
}> = [
  {
    value: "low",
    label: "Low",
    description: "Only clear-cut spam is blocked. Fewest false positives.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Borderline submissions are flagged for review. Recommended.",
  },
  {
    value: "strict",
    label: "Strict",
    description: "Borderline submissions are treated as spam. May catch legitimate mail.",
  },
];

interface SpamEditorProps {
  initial: FormSpamSettings;
  initialCaptchaEnabled: boolean;
  initialHoneypotFieldName: string | null;
  /** Names of the form's fields, for the rule target picker. */
  fieldNames: string[];
  canManage: boolean;
}

let newRuleCounter = 0;

export function SpamEditor({
  initial,
  initialCaptchaEnabled,
  initialHoneypotFieldName,
  fieldNames,
  canManage,
}: SpamEditorProps) {
  const [captchaEnabled, setCaptchaEnabled] = useState(initialCaptchaEnabled);
  const [honeypotFieldName, setHoneypotFieldName] = useState(initialHoneypotFieldName ?? "");
  const [sensitivity, setSensitivity] = useState<SpamSensitivity>(initial.sensitivity);
  const [blockDisposableEmails, setBlockDisposableEmails] = useState(initial.blockDisposableEmails);
  const [rateLimit, setRateLimit] = useState<string>(
    initial.rateLimitPerMinute === null ? "" : String(initial.rateLimitPerMinute),
  );
  const [rules, setRules] = useState<SpamRuleSummary[]>(initial.rules);
  const [saveState, setSaveState] = useState<EditorSaveState>("clean");

  const rateLimitInvalid =
    rateLimit.trim() !== "" && (!/^\d+$/.test(rateLimit.trim()) || Number(rateLimit) <= 0);
  const validationError = rateLimitInvalid
    ? "Rate limit must be a positive whole number, or left empty for the plan default."
    : rules.some((r) => r.pattern.trim() === "")
      ? "Every rule needs a pattern before saving — or remove the empty rule."
      : null;

  function markDirty() {
    setSaveState("dirty");
  }

  function updateRule(id: string, patch: Partial<SpamRuleSummary>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    markDirty();
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    markDirty();
  }

  function addRule() {
    newRuleCounter += 1;
    setRules((prev) => [
      ...prev,
      {
        id: `sr-new-${newRuleCounter}`,
        kind: "blocklist_term",
        targetField: null,
        pattern: "",
        weight: 0.5,
        enabled: true,
      },
    ]);
    markDirty();
  }

  const selectClassName = cn(
    "h-9 rounded-input border border-border bg-surface px-2 text-sm text-text-primary",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  return (
    <div className="space-y-4">
      {/* Built-in protection */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Built-in protection</CardTitle>
          <CardDescription>
            Signals evaluated on every submission before custom rules run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Toggle
            id="captcha-enabled"
            label="CAPTCHA challenge"
            description="Require a CAPTCHA token with each submission. Strongly recommended for public forms."
            checked={captchaEnabled}
            disabled={!canManage}
            onChange={(v) => {
              setCaptchaEnabled(v);
              markDirty();
            }}
          />
          <Toggle
            id="block-disposable"
            label="Block disposable email addresses"
            description="Reject submissions whose email uses a known throwaway provider."
            checked={blockDisposableEmails}
            disabled={!canManage}
            onChange={(v) => {
              setBlockDisposableEmails(v);
              markDirty();
            }}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field id="honeypot-field">
              <Label htmlFor="honeypot-field">Honeypot field name</Label>
              <Input
                value={honeypotFieldName}
                disabled={!canManage}
                onChange={(e) => {
                  setHoneypotFieldName(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. _trap — leave empty to disable"
                className="font-mono text-xs"
              />
              <p className="text-xs text-text-muted">
                A hidden field bots fill in and humans never see. Submissions with a
                value here are scored as spam.
              </p>
            </Field>
            <Field id="rate-limit">
              <Label htmlFor="rate-limit">Rate limit (per IP / minute)</Label>
              <Input
                value={rateLimit}
                disabled={!canManage}
                inputMode="numeric"
                onChange={(e) => {
                  setRateLimit(e.target.value);
                  markDirty();
                }}
                placeholder="Plan default"
                invalid={rateLimitInvalid}
              />
              <p className="text-xs text-text-muted">
                Submissions beyond this rate from one IP are rejected.
              </p>
            </Field>
          </div>

          {/* Sensitivity */}
          <fieldset>
            <legend className="text-sm font-medium text-text-primary">Sensitivity</legend>
            <p className="text-xs text-text-muted mt-0.5 mb-2">
              How the spam score translates into a verdict for this form.
            </p>
            <div className="grid sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Spam sensitivity">
              {SENSITIVITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={sensitivity === option.value}
                  disabled={!canManage}
                  onClick={() => {
                    setSensitivity(option.value);
                    markDirty();
                  }}
                  className={cn(
                    "rounded-card border p-3 text-left transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                    sensitivity === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background/60 hover:border-border-strong",
                    !canManage && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span className="block text-sm font-medium text-text-primary">{option.label}</span>
                  <span className="block text-xs text-text-muted mt-0.5">{option.description}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      {/* Custom rules */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Custom rules</CardTitle>
          <CardDescription>
            Rules run in order at ingest. A matching rule adds its weight to the
            submission&rsquo;s spam score; allowlist rules subtract.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <EmptyState
              title="No custom rules"
              description="Built-in protection still applies. Add a rule to block specific terms, addresses, IPs, or patterns."
            />
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-card border border-border bg-background/60 p-3"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`rule-kind-${rule.id}`}
                      className="text-xs font-medium text-text-secondary"
                    >
                      Rule type
                    </label>
                    <select
                      id={`rule-kind-${rule.id}`}
                      value={rule.kind}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateRule(rule.id, { kind: e.target.value as SpamRuleKind })
                      }
                      className={selectClassName}
                    >
                      {RULE_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 min-w-[160px] flex-1">
                    <label
                      htmlFor={`rule-pattern-${rule.id}`}
                      className="text-xs font-medium text-text-secondary"
                    >
                      Pattern
                    </label>
                    <Input
                      id={`rule-pattern-${rule.id}`}
                      value={rule.pattern}
                      disabled={!canManage}
                      onChange={(e) => updateRule(rule.id, { pattern: e.target.value })}
                      placeholder={
                        rule.kind === "blocklist_ip"
                          ? "203.0.113.10"
                          : rule.kind === "regex"
                            ? "regular expression"
                            : "text to match"
                      }
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`rule-field-${rule.id}`}
                      className="text-xs font-medium text-text-secondary"
                    >
                      Applies to
                    </label>
                    <select
                      id={`rule-field-${rule.id}`}
                      value={rule.targetField ?? ""}
                      disabled={!canManage || rule.kind === "blocklist_ip"}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          targetField: e.target.value === "" ? null : e.target.value,
                        })
                      }
                      className={selectClassName}
                    >
                      <option value="">All fields</option>
                      {fieldNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 w-24">
                    <label
                      htmlFor={`rule-weight-${rule.id}`}
                      className="text-xs font-medium text-text-secondary"
                    >
                      Weight
                    </label>
                    <Input
                      id={`rule-weight-${rule.id}`}
                      type="number"
                      step="0.1"
                      min="-1"
                      max="1"
                      value={rule.weight}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateRule(rule.id, { weight: Number(e.target.value) })
                      }
                    />
                  </div>

                  <div className="flex items-center gap-1 pb-1 ml-auto">
                    <label
                      htmlFor={`rule-enabled-${rule.id}`}
                      className="text-xs text-text-secondary"
                    >
                      On
                    </label>
                    <input
                      id={`rule-enabled-${rule.id}`}
                      type="checkbox"
                      checked={rule.enabled}
                      disabled={!canManage}
                      onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canManage}
                      onClick={() => removeRule(rule.id)}
                      aria-label={`Remove rule ${rule.pattern || rule.kind}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}

          {canManage && (
            <div className="pt-1">
              <Button variant="secondary" size="sm" onClick={addRule}>
                Add rule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <EditorFooter
          state={saveState}
          validationError={validationError}
          onSave={() => setSaveState("saved")}
          onReset={() => {
            setCaptchaEnabled(initialCaptchaEnabled);
            setHoneypotFieldName(initialHoneypotFieldName ?? "");
            setSensitivity(initial.sensitivity);
            setBlockDisposableEmails(initial.blockDisposableEmails);
            setRateLimit(
              initial.rateLimitPerMinute === null ? "" : String(initial.rateLimitPerMinute),
            );
            setRules(initial.rules);
            setSaveState("clean");
          }}
        />
      )}
    </div>
  );
}
