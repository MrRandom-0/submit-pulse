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
import type { FormDomainSummary } from "@/lib/dashboard-data";
import { EditorFooter, type EditorSaveState } from "./EditorFooter";
import { Toggle } from "./Toggle";

interface DomainsEditorProps {
  initialDomains: FormDomainSummary[];
  initialEnforceOrigin: boolean;
  initialAllowLocalhost: boolean;
  canUpdate: boolean;
}

let newDomainCounter = 0;

/**
 * Normalise user input into the stored host shape (mirrors the form_domains
 * checks: lowercase, no scheme, no path). Returns null when the result is
 * not a plausible host.
 */
function normaliseHost(raw: string): string | null {
  const host = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (host === "") return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    return null;
  }
  return host;
}

export function DomainsEditor({
  initialDomains,
  initialEnforceOrigin,
  initialAllowLocalhost,
  canUpdate,
}: DomainsEditorProps) {
  const [domains, setDomains] = useState<FormDomainSummary[]>(initialDomains);
  const [enforceOrigin, setEnforceOrigin] = useState(initialEnforceOrigin);
  const [allowLocalhost, setAllowLocalhost] = useState(initialAllowLocalhost);
  const [saveState, setSaveState] = useState<EditorSaveState>("clean");
  const [newHost, setNewHost] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  function markDirty() {
    setSaveState("dirty");
  }

  function update(id: string, patch: Partial<FormDomainSummary>) {
    setDomains((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    markDirty();
  }

  function remove(id: string) {
    setDomains((prev) => prev.filter((d) => d.id !== id));
    markDirty();
  }

  function addDomain() {
    const host = normaliseHost(newHost);
    if (host === null) {
      setAddError("Enter a valid host, e.g. example.com — no scheme or path.");
      return;
    }
    if (domains.some((d) => d.host === host)) {
      setAddError(`${host} is already in the allowlist.`);
      return;
    }
    newDomainCounter += 1;
    setDomains((prev) => [
      ...prev,
      {
        id: `fd-new-${newDomainCounter}`,
        host,
        includeSubdomains: false,
        isPreviewDomain: false,
        note: null,
      },
    ]);
    setNewHost("");
    setAddError(null);
    markDirty();
  }

  return (
    <div className="space-y-4">
      {/* Enforcement settings */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Origin enforcement</CardTitle>
          <CardDescription>
            Submissions are checked against the Origin header. Matching is exact —
            a host never matches a different host that merely contains it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            id="enforce-origin"
            label="Enforce origin allowlist"
            description={
              enforceOrigin
                ? "Only the domains listed below may submit to this form."
                : "Any origin may submit. Turn this on to restrict submissions to your own sites."
            }
            checked={enforceOrigin}
            disabled={!canUpdate}
            onChange={(v) => {
              setEnforceOrigin(v);
              markDirty();
            }}
          />
          <Toggle
            id="allow-localhost"
            label="Allow localhost"
            description="Permit submissions from localhost and 127.0.0.1 while developing."
            checked={allowLocalhost}
            disabled={!canUpdate}
            onChange={(v) => {
              setAllowLocalhost(v);
              markDirty();
            }}
          />
        </CardContent>
      </Card>

      {/* Allowlist */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Allowed domains</CardTitle>
          <CardDescription>
            {domains.length} domain{domains.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {domains.length === 0 ? (
            <EmptyState
              title="No domains configured"
              description="Add allowed origin domains to restrict form access."
            />
          ) : (
            <div className="rounded-card border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Host</th>
                    <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Subdomains</th>
                    <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Type</th>
                    <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Note</th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs text-text-primary">{d.host}</td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={d.includeSubdomains}
                          disabled={!canUpdate}
                          onChange={(e) => update(d.id, { includeSubdomains: e.target.checked })}
                          aria-label={`Include subdomains of ${d.host}`}
                          className="h-4 w-4 rounded accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {d.isPreviewDomain ? (
                          <Badge variant="warning">Preview</Badge>
                        ) : (
                          <Badge variant="success">Production</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={d.note ?? ""}
                          disabled={!canUpdate}
                          onChange={(e) =>
                            update(d.id, { note: e.target.value === "" ? null : e.target.value })
                          }
                          placeholder="—"
                          aria-label={`Note for ${d.host}`}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canUpdate}
                          onClick={() => remove(d.id)}
                          aria-label={`Remove ${d.host}`}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canUpdate && (
            <div className="pt-1">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    value={newHost}
                    onChange={(e) => {
                      setNewHost(e.target.value);
                      setAddError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDomain();
                      }
                    }}
                    placeholder="example.com"
                    aria-label="New allowed domain"
                    invalid={addError !== null}
                  />
                </div>
                <Button variant="secondary" size="md" onClick={addDomain}>
                  Add domain
                </Button>
              </div>
              {addError && (
                <p role="alert" className="text-xs text-danger mt-1.5">
                  {addError}
                </p>
              )}
              <p className="text-xs text-text-muted mt-1.5">
                Hosts are stored normalised — lowercase, without a scheme or path.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {canUpdate && (
        <EditorFooter
          state={saveState}
          onSave={() => setSaveState("saved")}
          onReset={() => {
            setDomains(initialDomains);
            setEnforceOrigin(initialEnforceOrigin);
            setAllowLocalhost(initialAllowLocalhost);
            setSaveState("clean");
          }}
        />
      )}
    </div>
  );
}
