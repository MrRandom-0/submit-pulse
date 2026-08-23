import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";
import { Badge, cn } from "@submitpulse/ui";
import {
  BASE_URL,
  ENDPOINTS,
  RATE_LIMITS,
  ERROR_CODES,
  WIRE_HEADERS,
} from "./api-data";
import { EndpointCard } from "./EndpointCard";

export const metadata: Metadata = {
  title: `API Reference — ${brand.name} Docs`,
  description: `Interactive reference for the ${brand.name} API — endpoints, parameters, request bodies, and every response your code needs to handle.`,
};

export default function ApiReferencePage() {
  const implementedEndpoints = ENDPOINTS.filter((e) => e.implemented);
  const stubEndpoints = ENDPOINTS.filter((e) => !e.implemented);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 text-sm text-text-muted" role="list">
          <li>
            <Link
              href="/docs"
              className="hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
            >
              Docs
            </Link>
          </li>
          <li aria-hidden className="select-none">/</li>
          <li className="text-text-primary font-medium">API Reference</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">
          API Reference
        </h1>
        <p className="text-base text-text-secondary leading-relaxed max-w-2xl">
          Interactive reference for the {brand.name} HTTP API. Click any
          endpoint to expand it, view parameters, try example requests, and see
          every response your code must handle.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-text-muted">Base URL:</span>
          <code className="text-sm font-mono text-text-primary bg-code-background px-2 py-1 rounded">
            {BASE_URL}
          </code>
        </div>
      </div>

      {/* Jump links */}
      <div
        className="flex flex-wrap gap-3 mb-10 text-sm"
        aria-label="Jump to section"
      >
        {[
          { href: "#implemented", label: "Implemented endpoints" },
          { href: "#error-codes", label: "Error codes" },
          { href: "#rate-limits", label: "Rate limits" },
          { href: "#headers", label: "Wire headers" },
          { href: "#stubs", label: "Planned endpoints" },
        ].map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
          >
            {l.label}
          </a>
        ))}
      </div>

      {/* Implemented endpoints */}
      <section aria-labelledby="implemented-heading" className="mb-16" id="implemented">
        <h2
          id="implemented-heading"
          className="text-xl font-semibold text-text-primary mb-6 flex items-center gap-3"
        >
          Implemented endpoints
          <Badge variant="success" size="sm">
            Live
          </Badge>
        </h2>
        <div className="space-y-3">
          {implementedEndpoints.map((ep, i) => (
            <EndpointCard
              key={ep.id}
              endpoint={ep}
              defaultOpen={i === 2} // open the main submission endpoint by default
            />
          ))}
        </div>
      </section>

      {/* Error codes */}
      <section aria-labelledby="error-codes-heading" className="mb-16" id="error-codes">
        <h2
          id="error-codes-heading"
          className="text-xl font-semibold text-text-primary mb-4"
        >
          Error codes
        </h2>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          All errors use the same envelope:{" "}
          <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
            {"{ ok: false, requestId, error: { code, message, fields? } }"}
          </code>
          . The <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">fields</code>{" "}
          array is present only for <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">VALIDATION_ERROR</code>.
        </p>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated border-b border-border">
                <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">
                  HTTP
                </th>
                <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">
                  error.code
                </th>
                <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">
                  Cause
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ERROR_CODES.map((row) => (
                <tr key={row.code} className="hover:bg-surface-elevated/50">
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold",
                        row.status < 500
                          ? "bg-warning/10 text-warning border border-warning/30"
                          : "bg-danger/10 text-danger border border-danger/30",
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-text-primary">
                      {row.code}
                    </code>
                    {row.hasFields && (
                      <span className="ml-2 text-xs text-text-muted">
                        + fields[]
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {row.cause}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rate limits */}
      <section aria-labelledby="rate-limits-heading" className="mb-16" id="rate-limits">
        <h2
          id="rate-limits-heading"
          className="text-xl font-semibold text-text-primary mb-4"
        >
          Rate limits
        </h2>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          Three independent limits are applied in order. All return{" "}
          <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
            429 RATE_LIMITED
          </code>
          . The response does not specify which limit fired. Retry after at
          least 60 seconds; use exponential backoff with jitter.
        </p>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated border-b border-border">
                <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">
                  Limit
                </th>
                <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">
                  Max requests
                </th>
                <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">
                  Window
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {RATE_LIMITS.map((row) => (
                <tr key={row.label} className="hover:bg-surface-elevated/50">
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                    {row.limit}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {row.window}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Wire headers */}
      <section aria-labelledby="headers-heading" className="mb-16" id="headers">
        <h2
          id="headers-heading"
          className="text-xl font-semibold text-text-primary mb-4"
        >
          Wire headers
        </h2>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          All header names are derived from{" "}
          <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
            packages/config/src/brand.ts
          </code>
          . The{" "}
          <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
            brand.wire.*
          </code>{" "}
          constants guarantee that docs and code stay in sync.
        </p>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated border-b border-border">
                <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">
                  Header
                </th>
                <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">
                  Direction
                </th>
                <th className="px-4 py-3 text-left text-text-muted font-medium text-xs hidden sm:table-cell">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {WIRE_HEADERS.map((row) => (
                <tr key={row.header} className="hover:bg-surface-elevated/50">
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-text-primary">
                      {row.header}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {row.direction}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary hidden sm:table-cell">
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Planned / stub endpoints */}
      {stubEndpoints.length > 0 && (
        <section aria-labelledby="stubs-heading" className="mb-12" id="stubs">
          <h2
            id="stubs-heading"
            className="text-xl font-semibold text-text-primary mb-3 flex items-center gap-3"
          >
            Planned endpoints
            <Badge variant="neutral" size="sm">
              Not implemented
            </Badge>
          </h2>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            These endpoints are documented to describe the intended design
            surface. No handler currently exists — all management operations use
            the {brand.name} dashboard at{" "}
            <a
              href={brand.domains.app}
              className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
              target="_blank"
              rel="noopener noreferrer"
            >
              {brand.domains.app}
            </a>
            .
          </p>
          <div className="space-y-2">
            {stubEndpoints.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <div className="pt-8 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-text-muted">
          <span>
            OpenAPI 3.1 spec:{" "}
            <a
              href={`${BASE_URL}/openapi.yaml`}
              className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
              target="_blank"
              rel="noopener noreferrer"
            >
              openapi.yaml
            </a>
          </span>
          <span className="hidden sm:block" aria-hidden>
            ·
          </span>
          <Link
            href="/docs/webhook-reference"
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
          >
            Webhook Reference →
          </Link>
          <span className="hidden sm:block" aria-hidden>
            ·
          </span>
          <a
            href={`mailto:${brand.email.support}`}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
