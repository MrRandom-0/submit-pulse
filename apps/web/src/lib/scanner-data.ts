/**
 * DEVELOPMENT FIXTURES — scanner, drift, and agency data.
 * Replace with real API/database calls before shipping.
 * Not production data. All values are invented for UI development only.
 *
 * Column names and enum values match the real schema in packages/database/src/schema/health.ts,
 * forms.ts, and identity.ts.
 */

import type { ScanIssue, DriftResult } from "@submitpulse/scanner";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Scanner fixtures
// ---------------------------------------------------------------------------

export interface ScanResultFixture {
  id: string;
  url: string;
  httpStatus: number;
  formFound: boolean;
  scannedAt: Date;
  issues: ScanIssue[];
}

const FIXTURE_SCAN_ISSUES: ScanIssue[] = [
  {
    code: "method-get",
    title: "Form uses GET method — data exposed in URL",
    explanation:
      "The form uses HTTP GET, which appends all field values to the URL query string. " +
      "This exposes submitted data in browser history, server access logs, and referrer headers.",
    evidence: '<form action="/contact" method="get">',
    recommendedFix: 'Change the form method attribute to method="post".',
    severity: "Critical",
    aiRepairPrompt:
      "Fix scanner issue in the \"Contact Us\" form [method-get]\n" +
      "=".repeat(60) +
      "\n\nChange method from GET to POST on the <form> element.",
  },
  {
    code: "missing-label",
    title: "Input has no associated label",
    explanation:
      "Every form input must have a programmatically associated label so that screen readers " +
      "can announce it. Without a label, the field is inaccessible to assistive technology users.",
    evidence: '<input type="email" name="email" placeholder="Enter email" />',
    recommendedFix:
      'Add a <label for="emailId"> element, or add aria-label="Email address" directly to the input.',
    severity: "Warning",
    aiRepairPrompt:
      "Fix scanner issue in the \"Contact Us\" form [missing-label]\n" +
      "=".repeat(60) +
      "\n\nAdd an associated <label> to the email input field.",
  },
  {
    code: "no-success-state",
    title: "No visible success state detected",
    explanation:
      "After a successful form submission, users need feedback confirming their action. " +
      "Without a success state, users may submit repeatedly or lose trust.",
    evidence:
      "No success-indicating text, class, or aria role found in form[0] HTML block.",
    recommendedFix:
      "Show a success message or redirect to a confirmation page after 2xx response.",
    severity: "Warning",
    aiRepairPrompt:
      "Fix scanner issue in the \"Contact Us\" form [no-success-state]\n" +
      "=".repeat(60) +
      "\n\nAdd a visible success state that appears after a 2xx response.",
  },
  {
    code: "no-captcha",
    title: "No CAPTCHA or bot protection detected",
    explanation:
      "Public-facing forms without bot protection are vulnerable to spam and automated abuse. " +
      "Consider adding Cloudflare Turnstile.",
    evidence: "No Turnstile, hCaptcha, or reCAPTCHA markup found in the page HTML.",
    recommendedFix:
      "Add Cloudflare Turnstile to the form. Include cf-turnstile-response in submissions.",
    severity: "Improvement",
    aiRepairPrompt:
      "Fix scanner issue in the \"Contact Us\" form [no-captcha]\n" +
      "=".repeat(60) +
      "\n\nAdd Cloudflare Turnstile widget to the form.",
  },
  {
    code: "missing-autocomplete",
    title: 'Personal-data field missing "autocomplete" attribute',
    explanation:
      "Adding autocomplete to fields like name, email, and phone helps users fill forms " +
      "faster and reduces errors. Required for WCAG 1.3.5 Input Purpose compliance.",
    evidence: '<input type="text" name="name" required />',
    recommendedFix: 'Add autocomplete="name" to the name input.',
    severity: "Improvement",
    aiRepairPrompt:
      "Fix scanner issue in the \"Contact Us\" form [missing-autocomplete]\n" +
      "=".repeat(60) +
      "\n\nAdd autocomplete attributes to personal-data fields.",
  },
];

export const FIXTURE_SCAN_RESULTS: ScanResultFixture[] = [
  {
    id: "scan-001",
    url: "https://acme.example.com/contact",
    httpStatus: 200,
    formFound: true,
    scannedAt: hoursAgo(1),
    issues: FIXTURE_SCAN_ISSUES,
  },
];

export async function getLatestScanResult(
  _formId: string,
): Promise<ScanResultFixture | null> {
  return FIXTURE_SCAN_RESULTS[0] ?? null;
}

// ---------------------------------------------------------------------------
// Drift fixtures
// ---------------------------------------------------------------------------

export interface DriftEventFixture {
  id: string;
  formId: string;
  formName: string;
  kind: DriftResult["kind"];
  resolution: "unresolved" | "accepted" | "mapped" | "ignored";
  detectedAt: Date;
  occurrenceCount: number;
  fieldName: string | null;
  previousDefinition: Record<string, unknown> | null;
  observedDefinition: Record<string, unknown> | null;
  aiRepairPrompt: string | null;
  /** Rename confidence for field_renamed events. */
  renameConfidence?: number | undefined;
  renameConfidenceLabel?: "high" | "medium" | "low" | undefined;
}

export const FIXTURE_DRIFT_EVENTS: DriftEventFixture[] = [
  {
    id: "drift-001",
    formId: "form-001",
    formName: "Contact Us",
    kind: "field_renamed",
    resolution: "unresolved",
    detectedAt: hoursAgo(3),
    occurrenceCount: 12,
    fieldName: "full_name",
    previousDefinition: { name: "name", type: "text", required: true },
    observedDefinition: { name: "full_name", inferredType: "text" },
    aiRepairPrompt:
      'Repair field name mismatch in the "Contact Us" form\n' +
      "=".repeat(60) +
      '\n\nEvidence of mismatch:\n  Your deployed form sends "full_name" but the schema expects "name".\n\n' +
      'Fix:\n  Rename every reference to "full_name" to "name".',
    renameConfidence: 0.82,
    renameConfidenceLabel: "high",
  },
  {
    id: "drift-002",
    formId: "form-002",
    formName: "Newsletter Signup",
    kind: "field_added",
    resolution: "unresolved",
    detectedAt: daysAgo(1),
    occurrenceCount: 47,
    fieldName: "utm_source",
    previousDefinition: null,
    observedDefinition: { name: "utm_source", inferredType: "text" },
    aiRepairPrompt: null,
    renameConfidence: undefined,
    renameConfidenceLabel: undefined,
  },
  {
    id: "drift-003",
    formId: "form-001",
    formName: "Contact Us",
    kind: "field_removed",
    resolution: "ignored",
    detectedAt: daysAgo(5),
    occurrenceCount: 3,
    fieldName: "company",
    previousDefinition: { name: "company", type: "text", required: false },
    observedDefinition: null,
    aiRepairPrompt: null,
    renameConfidence: undefined,
    renameConfidenceLabel: undefined,
  },
  {
    id: "drift-004",
    formId: "form-003",
    formName: "Job Application",
    kind: "type_changed",
    resolution: "unresolved",
    detectedAt: daysAgo(2),
    occurrenceCount: 8,
    fieldName: "resume",
    previousDefinition: { name: "resume", type: "file", required: true },
    observedDefinition: { name: "resume", inferredType: "text" },
    aiRepairPrompt:
      'Repair field type mismatch in the "Job Application" form\n' +
      "=".repeat(60) +
      '\n\nField "resume" expected type "file" but observed "text".',
    renameConfidence: undefined,
    renameConfidenceLabel: undefined,
  },
];

export async function listDriftEvents(opts?: {
  formId?: string | undefined;
  resolution?: DriftEventFixture["resolution"] | undefined;
}): Promise<DriftEventFixture[]> {
  let results = [...FIXTURE_DRIFT_EVENTS];
  if (opts?.formId !== undefined) {
    results = results.filter((d) => d.formId === opts.formId);
  }
  if (opts?.resolution !== undefined) {
    results = results.filter((d) => d.resolution === opts.resolution);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Agency fixtures
// ---------------------------------------------------------------------------

export type ClientHealthStatus = "healthy" | "degraded" | "failing" | "paused" | "setup_incomplete";

export interface ClientWorkspace {
  id: string;
  slug: string;
  name: string;
  /** Matches workspaces.kind = "client" */
  kind: "client";
  plan: "free" | "starter" | "pro" | "agency";
  formCount: number;
  healthySummary: {
    healthy: number;
    degraded: number;
    failing: number;
    paused: number;
    setup_incomplete: number;
  };
  overallHealth: ClientHealthStatus;
  submissionsThisMonth: number;
  lastActivityAt: Date | null;
  /** Branding from workspaces.branding JSON column */
  branding: {
    logoUrl?: string | undefined;
    accentColor?: string | undefined;
    replyToEmail?: string | undefined;
  } | null;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  fieldCount: number;
  category: "contact" | "lead" | "support" | "survey" | "application" | "other";
  usedByClientCount: number;
}

export interface AgencyOverview {
  totalClients: number;
  totalForms: number;
  totalSubmissionsThisMonth: number;
  clientsWithIssues: number;
  plan: "agency";
}

export const FIXTURE_CLIENT_WORKSPACES: ClientWorkspace[] = [
  {
    id: "ws-client-001",
    slug: "acme-corp",
    name: "Acme Corp",
    kind: "client",
    plan: "pro",
    formCount: 5,
    healthySummary: { healthy: 4, degraded: 1, failing: 0, paused: 0, setup_incomplete: 0 },
    overallHealth: "degraded",
    submissionsThisMonth: 1_284,
    lastActivityAt: hoursAgo(2),
    branding: null,
  },
  {
    id: "ws-client-002",
    slug: "globex-industries",
    name: "Globex Industries",
    kind: "client",
    plan: "pro",
    formCount: 3,
    healthySummary: { healthy: 2, degraded: 0, failing: 1, paused: 0, setup_incomplete: 0 },
    overallHealth: "failing",
    submissionsThisMonth: 487,
    lastActivityAt: daysAgo(3),
    branding: { accentColor: "#e24b2f" },
  },
  {
    id: "ws-client-003",
    slug: "initech",
    name: "Initech",
    kind: "client",
    plan: "starter",
    formCount: 2,
    healthySummary: { healthy: 2, degraded: 0, failing: 0, paused: 0, setup_incomplete: 0 },
    overallHealth: "healthy",
    submissionsThisMonth: 93,
    lastActivityAt: hoursAgo(6),
    branding: { logoUrl: "https://via.placeholder.com/120x32?text=Initech", accentColor: "#0055cc" },
  },
  {
    id: "ws-client-004",
    slug: "umbrella-hq",
    name: "Umbrella HQ",
    kind: "client",
    plan: "free",
    formCount: 1,
    healthySummary: { healthy: 0, degraded: 0, failing: 0, paused: 1, setup_incomplete: 0 },
    overallHealth: "paused",
    submissionsThisMonth: 0,
    lastActivityAt: daysAgo(14),
    branding: null,
  },
];

export const FIXTURE_FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "tpl-001",
    name: "Simple Contact Form",
    description: "Name, email, and message — the classic three-field contact form.",
    fieldCount: 3,
    category: "contact",
    usedByClientCount: 3,
  },
  {
    id: "tpl-002",
    name: "Lead Capture with CAPTCHA",
    description: "Email + first name with Turnstile bot protection enabled.",
    fieldCount: 2,
    category: "lead",
    usedByClientCount: 2,
  },
  {
    id: "tpl-003",
    name: "Support Request",
    description: "Subject, priority, description, and optional file attachment.",
    fieldCount: 4,
    category: "support",
    usedByClientCount: 1,
  },
  {
    id: "tpl-004",
    name: "5-Star Survey",
    description: "Rating (1–5) plus open-ended feedback textarea.",
    fieldCount: 2,
    category: "survey",
    usedByClientCount: 0,
  },
];

export const FIXTURE_AGENCY_OVERVIEW: AgencyOverview = {
  totalClients: FIXTURE_CLIENT_WORKSPACES.length,
  totalForms: FIXTURE_CLIENT_WORKSPACES.reduce((acc, c) => acc + c.formCount, 0),
  totalSubmissionsThisMonth: FIXTURE_CLIENT_WORKSPACES.reduce(
    (acc, c) => acc + c.submissionsThisMonth,
    0,
  ),
  clientsWithIssues: FIXTURE_CLIENT_WORKSPACES.filter(
    (c) => c.overallHealth === "failing" || c.overallHealth === "degraded",
  ).length,
  plan: "agency",
};

export async function getAgencyOverview(): Promise<AgencyOverview> {
  return FIXTURE_AGENCY_OVERVIEW;
}

export async function listClientWorkspaces(): Promise<ClientWorkspace[]> {
  return FIXTURE_CLIENT_WORKSPACES;
}

export async function listFormTemplates(): Promise<FormTemplate[]> {
  return FIXTURE_FORM_TEMPLATES;
}
