"use client";

/**
 * Client-side scanner shell. Manages scan state and renders the progressive
 * disclosure flow: URL input → scanning → results.
 *
 * The actual scan is server-side (POST to /api/scanner) to prevent CORS issues
 * and keep the SSRF guard server-authoritative. Here we only drive the UI.
 */

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
  Badge,
  StatusDot,
  Skeleton,
} from "@submitpulse/ui";
import { ScanUrlForm } from "@/components/scanner/ScanUrlForm";
import { IssueList } from "@/components/scanner/IssueCard";
import type { ScanIssue } from "@submitpulse/scanner";

// ---------------------------------------------------------------------------
// Types matching the API response from /api/scanner
// ---------------------------------------------------------------------------

interface ScanApiResponse {
  url: string;
  httpStatus: number;
  formFound: boolean;
  scannedAt: string;
  ssrfBlocked: boolean;
  ssrfReason?: string | undefined;
  issues: ScanIssue[];
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ScanSkeleton() {
  return (
    <div className="space-y-3" aria-label="Scanning in progress" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="rounded-card shadow-card">
          <CardContent className="py-4 flex items-center gap-3">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="w-16 h-5 rounded-pill" />
            <Skeleton className="flex-1 h-4 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Premium empty state — shown before first scan
// ---------------------------------------------------------------------------

function PreScanEmptyState() {
  return (
    <EmptyState
      icon={
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M6 9h6M9 6v6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      }
      title="Scan your live form"
      description={
        "Enter the URL of a page containing a form. The scanner will analyse its " +
        "submission endpoint, HTTP method, field labels, accessibility, CAPTCHA " +
        "presence, and check for leaked secrets in the markup."
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Results summary bar
// ---------------------------------------------------------------------------

function ResultsSummary({ result }: { result: ScanApiResponse }) {
  const critical = result.issues.filter((i) => i.severity === "Critical").length;
  const warning = result.issues.filter((i) => i.severity === "Warning").length;
  const improvement = result.issues.filter((i) => i.severity === "Improvement").length;

  const overallStatus =
    critical > 0
      ? ("failing" as const)
      : warning > 0
        ? ("degraded" as const)
        : ("healthy" as const);

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-background border border-border rounded-card">
      <StatusDot status={overallStatus} showLabel />
      <div className="h-4 w-px bg-border" aria-hidden />
      <span className="text-sm text-text-muted">
        <span className="font-medium text-text-primary">{result.url}</span>
      </span>
      <div className="flex-1" />
      {critical > 0 && (
        <Badge variant="danger" size="sm">{critical} Critical</Badge>
      )}
      {warning > 0 && (
        <Badge variant="warning" size="sm">{warning} Warning</Badge>
      )}
      {improvement > 0 && (
        <Badge variant="neutral" size="sm">{improvement} Improvement</Badge>
      )}
      {result.issues.length === 0 && (
        <Badge variant="success" size="sm">No issues found</Badge>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function ScannerClient() {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ScanApiResponse | null>(null);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  async function handleScan(url: string) {
    setLoading(true);
    setFetchError(null);
    setResult(null);

    try {
      const res = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setFetchError(body.error ?? `Server returned ${res.status}.`);
        return;
      }

      const data = await res.json() as ScanApiResponse;

      if (data.ssrfBlocked) {
        setFetchError(
          `This URL was blocked by the SSRF guard (reason: ${data.ssrfReason ?? "unknown"}). ` +
          "Only public HTTPS URLs are allowed.",
        );
        return;
      }

      setResult(data);
    } catch {
      setFetchError("Network error — could not reach the scanner. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Input card */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Scan a form page</CardTitle>
          <CardDescription>
            Enter the public HTTPS URL of a page containing a form. Results reflect
            the static server-rendered HTML — client-side rendered forms may show
            fewer results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScanUrlForm onScan={handleScan} loading={loading} />
        </CardContent>
      </Card>

      {/* Error state */}
      {fetchError !== null && (
        <div
          role="alert"
          className="rounded-card border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {fetchError}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <ScanSkeleton />}

      {/* Results */}
      {result !== null && !loading && (
        <div className="space-y-4">
          <ResultsSummary result={result} />

          {!result.formFound && (
            <EmptyState
              title="No form found"
              description={
                "The scanner did not find a <form> element in the static HTML. " +
                "The form may be rendered client-side (React, Next.js, etc.). " +
                "Try viewing page source to confirm."
              }
            />
          )}

          {result.issues.length > 0 && (
            <IssueList issues={result.issues} />
          )}

          {result.formFound && result.issues.length === 0 && (
            <EmptyState
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 10.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              title="No issues found"
              description="This form passed all scanner checks. Keep up the good work."
            />
          )}
        </div>
      )}

      {/* Pre-scan state */}
      {result === null && !loading && fetchError === null && <PreScanEmptyState />}
    </div>
  );
}
