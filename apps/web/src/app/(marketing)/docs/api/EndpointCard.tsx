"use client";

import * as React from "react";
import {
  Badge,
  CodeBlock,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  cn,
} from "@submitpulse/ui";
import type { EndpointDef, ResponseDef } from "./api-data";

// ---------------------------------------------------------------------------
// Method badge colours
// ---------------------------------------------------------------------------

function MethodBadge({
  method,
}: {
  method: EndpointDef["method"];
}): React.ReactElement {
  const variants: Record<EndpointDef["method"], string> = {
    GET: "bg-success/10 text-success border border-success/30",
    POST: "bg-primary/10 text-primary border border-primary/30",
    OPTIONS: "bg-text-muted/10 text-text-muted border border-border",
    PATCH: "bg-warning/10 text-warning border border-warning/30",
    DELETE: "bg-danger/10 text-danger border border-danger/30",
  };
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded text-xs font-mono font-bold",
        variants[method],
      )}
    >
      {method}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: number }): React.ReactElement {
  const cls =
    status < 300
      ? "bg-success/10 text-success border border-success/30"
      : status < 400
        ? "bg-info/10 text-info border border-info/30"
        : status < 500
          ? "bg-warning/10 text-warning border border-warning/30"
          : "bg-danger/10 text-danger border border-danger/30";
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold", cls)}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Collapsible response row
// ---------------------------------------------------------------------------

function ResponseRow({ res }: { res: ResponseDef }): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left",
          "hover:bg-surface-elevated transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset",
        )}
        aria-expanded={open}
      >
        <StatusBadge status={res.status} />
        <span className="text-sm text-text-secondary flex-1">{res.description}</span>
        <span className="text-xs text-text-muted select-none" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && res.body && (
        <div className="border-t border-border">
          <CodeBlock code={res.body} language="json" copyable maxHeight={320} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Endpoint card
// ---------------------------------------------------------------------------

export function EndpointCard({
  endpoint,
  defaultOpen = false,
}: {
  endpoint: EndpointDef;
  defaultOpen?: boolean;
}): React.ReactElement {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div
      id={endpoint.id}
      className="border border-border rounded-card overflow-hidden bg-surface"
    >
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 px-5 py-4 text-left",
          "hover:bg-surface-elevated transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset",
          open && "border-b border-border",
        )}
        aria-expanded={open}
        aria-controls={`${endpoint.id}-body`}
      >
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-mono text-text-primary flex-1">
          {endpoint.path}
        </code>
        <span className="text-sm text-text-secondary hidden sm:block">
          {endpoint.summary}
        </span>
        {!endpoint.implemented && (
          <Badge variant="neutral" size="sm">
            Not implemented
          </Badge>
        )}
        <span className="text-xs text-text-muted select-none" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Body */}
      {open && (
        <div id={`${endpoint.id}-body`} className="px-5 py-5 space-y-8">
          {/* Description */}
          <div className="prose prose-sm max-w-none">
            {endpoint.description.split("\n\n").map((para, i) => (
              <p key={i} className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {para}
              </p>
            ))}
          </div>

          {/* Parameters */}
          {endpoint.params && endpoint.params.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Parameters
              </h3>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-elevated border-b border-border">
                      <th className="px-3 py-2 text-left text-text-muted font-medium">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-text-muted font-medium">
                        In
                      </th>
                      <th className="px-3 py-2 text-left text-text-muted font-medium hidden sm:table-cell">
                        Required
                      </th>
                      <th className="px-3 py-2 text-left text-text-muted font-medium">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {endpoint.params.map((p) => (
                      <tr key={p.name} className="hover:bg-surface-elevated/50">
                        <td className="px-3 py-2">
                          <code className="font-mono text-text-primary">
                            {p.name}
                          </code>
                        </td>
                        <td className="px-3 py-2 text-text-muted capitalize">
                          {p.location}
                        </td>
                        <td className="px-3 py-2 text-text-muted hidden sm:table-cell">
                          {p.required ? "yes" : "no"}
                        </td>
                        <td className="px-3 py-2 text-text-secondary leading-snug">
                          {p.description}
                          {p.example && (
                            <span className="block mt-0.5 text-text-muted">
                              Example:{" "}
                              <code className="font-mono">{p.example}</code>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request examples */}
          {endpoint.requestTabs && endpoint.requestTabs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Request body
              </h3>
              <Tabs defaultValue={endpoint.requestTabs[0].label}>
                <TabsList>
                  {endpoint.requestTabs.map((tab) => (
                    <TabsTrigger key={tab.label} value={tab.label}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {endpoint.requestTabs.map((tab) => (
                  <TabsContent key={tab.label} value={tab.label}>
                    <CodeBlock
                      code={tab.code}
                      language={tab.language}
                      copyable
                      maxHeight={400}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          {/* Responses */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              Responses
            </h3>
            <div className="space-y-2">
              {endpoint.responses.map((res) => (
                <ResponseRow key={res.status} res={res} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
