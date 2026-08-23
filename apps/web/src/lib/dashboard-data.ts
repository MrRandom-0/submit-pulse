/**
 * DEVELOPMENT FIXTURES — replace with real Drizzle queries in packages/database.
 * Not production data. All values are invented for UI development only.
 *
 * Column names match the real schema in packages/database/src/schema/.
 */

import type { PlanId } from "@submitpulse/config";

// ---------------------------------------------------------------------------
// Shared enum types (mirroring the pg enums in the schema)
// ---------------------------------------------------------------------------

export type FormStatus = "active" | "paused" | "archived";
export type HealthStatus =
  | "healthy"
  | "degraded"
  | "failing"
  | "paused"
  | "setup_incomplete";
export type SubmissionStatus = "new" | "read" | "archived" | "deleted";
export type SpamVerdict = "clean" | "suspect" | "spam";
export type SubmissionOrigin = "live" | "test" | "synthetic";
export type FileScanStatus = "pending" | "clean" | "infected" | "error";

// ---------------------------------------------------------------------------
// View model types (field names match schema column names exactly)
// ---------------------------------------------------------------------------

export interface FormSummary {
  id: string;
  publicId: string;
  name: string;
  websiteUrl: string | null;
  status: FormStatus;
  healthStatus: HealthStatus;
  submissionCount: number;
  spamBlockedCount: number;
  lastSubmissionAt: Date | null;
  captchaEnabled: boolean;
  enforceOrigin: boolean;
  createdAt: Date;
}

export interface FormDetail extends FormSummary {
  honeypotFieldName: string | null;
  allowLocalhost: boolean;
  maxBodyBytes: number;
  fileUploadsEnabled: boolean;
  successRedirectUrl: string | null;
  retentionDaysOverride: number | null;
  updatedAt: Date;
  fields: FormFieldSummary[];
  domains: FormDomainSummary[];
}

export interface FormFieldSummary {
  id: string;
  name: string;
  label: string | null;
  type: string;
  required: boolean;
  position: number;
  isInternal: boolean;
  isSensitive: boolean;
}

export interface FormDomainSummary {
  id: string;
  host: string;
  includeSubdomains: boolean;
  isPreviewDomain: boolean;
  note: string | null;
}

export interface SubmissionSummary {
  id: string;
  publicId: string;
  formId: string;
  formName: string;
  status: SubmissionStatus;
  origin: SubmissionOrigin;
  spamVerdict: SpamVerdict;
  spamScore: number;
  countryCode: string | null;
  referrer: string | null;
  processingMs: number | null;
  createdAt: Date;
  readAt: Date | null;
  // Preview of submitted data (first few fields)
  previewFields: Array<{ name: string; value: string }>;
}

export interface SpamSignal {
  code: string;
  label: string;
  weight: number;
  evidence: string | undefined;
}

export interface SubmissionEvent {
  id: string;
  kind: string;
  message: string | null;
  durationMs: number | null;
  createdAt: Date;
}

export interface SubmissionFile {
  id: string;
  fieldName: string;
  originalFilename: string;
  sizeBytes: number;
  detectedMimeType: string;
  scanStatus: FileScanStatus;
}

export interface SubmissionNote {
  id: string;
  body: string;
  authorUserId: string | null;
  authorName: string;
  createdAt: Date;
  editedAt: Date | null;
}

export interface SubmissionDetail {
  id: string;
  publicId: string;
  formId: string;
  formName: string;
  requestId: string;
  status: SubmissionStatus;
  origin: SubmissionOrigin;
  // Submitted field values — rendered text-only, never as HTML
  data: Record<string, unknown>;
  unexpectedData: Record<string, unknown> | null;
  schemaVersionId: string | null;
  spamVerdict: SpamVerdict;
  spamScore: number;
  spamSignals: SpamSignal[];
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;
  originHeader: string | null;
  countryCode: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  processingMs: number | null;
  createdAt: Date;
  updatedAt: Date;
  readAt: Date | null;
  deletedAt: Date | null;
  events: SubmissionEvent[];
  files: SubmissionFile[];
  notes: SubmissionNote[];
  tags: string[];
  emailStatus: "sent" | "failed" | "skipped" | "pending";
  webhookStatus: "delivered" | "failed" | "skipped" | "pending" | null;
}

export interface ActivityEvent {
  id: string;
  kind:
    | "submission_received"
    | "form_created"
    | "spam_blocked"
    | "health_incident"
    | "health_recovered"
    | "webhook_failed";
  message: string;
  formName: string | null;
  createdAt: Date;
}

export interface OverviewMetrics {
  submissionsToday: number;
  submissionsThisMonth: number;
  spamBlockedThisMonth: number;
  activeForms: number;
  formsHealthy: number;
  failedDeliveries: number;
  avgProcessingMs: number;
  plan: PlanId;
  submissionsUsed: number;
  submissionsQuota: number | null;
  formsUsed: number;
  formsQuota: number | null;
  recentActivity: ActivityEvent[];
  latestSubmissions: SubmissionSummary[];
  formHealthSummary: Array<{
    id: string;
    name: string;
    healthStatus: HealthStatus;
    lastSubmissionAt: Date | null;
  }>;
}

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

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const FIXTURE_FORMS: FormDetail[] = [
  {
    id: "form-001",
    publicId: "fm_aB3xK9mNpQ7rS2tU8vW4yZ",
    name: "Contact Us",
    websiteUrl: "https://acme.example.com/contact",
    status: "active",
    healthStatus: "healthy",
    submissionCount: 1_247,
    spamBlockedCount: 83,
    lastSubmissionAt: minutesAgo(14),
    captchaEnabled: true,
    enforceOrigin: true,
    honeypotFieldName: "_trap",
    allowLocalhost: false,
    maxBodyBytes: 1_048_576,
    fileUploadsEnabled: false,
    successRedirectUrl: "https://acme.example.com/thank-you",
    retentionDaysOverride: null,
    createdAt: daysAgo(42),
    updatedAt: daysAgo(2),
    fields: [
      { id: "ff-1", name: "name", label: "Full Name", type: "text", required: true, position: 0, isInternal: false, isSensitive: false },
      { id: "ff-2", name: "email", label: "Email Address", type: "email", required: true, position: 1, isInternal: false, isSensitive: false },
      { id: "ff-3", name: "message", label: "Message", type: "textarea", required: true, position: 2, isInternal: false, isSensitive: false },
      { id: "ff-4", name: "_trap", label: null, type: "text", required: false, position: 3, isInternal: true, isSensitive: false },
    ],
    domains: [
      { id: "fd-1", host: "acme.example.com", includeSubdomains: false, isPreviewDomain: false, note: "Production" },
      { id: "fd-2", host: "acme.vercel.app", includeSubdomains: true, isPreviewDomain: true, note: null },
    ],
  },
  {
    id: "form-002",
    publicId: "fm_cD5eF6gH7iJ8kL9mN0oP1",
    name: "Newsletter Signup",
    websiteUrl: "https://acme.example.com",
    status: "active",
    healthStatus: "degraded",
    submissionCount: 3_891,
    spamBlockedCount: 412,
    lastSubmissionAt: hoursAgo(2),
    captchaEnabled: false,
    enforceOrigin: true,
    honeypotFieldName: null,
    allowLocalhost: true,
    maxBodyBytes: 1_048_576,
    fileUploadsEnabled: false,
    successRedirectUrl: null,
    retentionDaysOverride: null,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(1),
    fields: [
      { id: "ff-5", name: "email", label: "Email", type: "email", required: true, position: 0, isInternal: false, isSensitive: false },
      { id: "ff-6", name: "first_name", label: "First Name", type: "text", required: false, position: 1, isInternal: false, isSensitive: false },
    ],
    domains: [
      { id: "fd-3", host: "acme.example.com", includeSubdomains: true, isPreviewDomain: false, note: null },
    ],
  },
  {
    id: "form-003",
    publicId: "fm_qR2sT3uV4wX5yZ6aB7cD8",
    name: "Job Application",
    websiteUrl: "https://acme.example.com/careers",
    status: "active",
    healthStatus: "failing",
    submissionCount: 204,
    spamBlockedCount: 11,
    lastSubmissionAt: daysAgo(3),
    captchaEnabled: true,
    enforceOrigin: true,
    honeypotFieldName: "_bot",
    allowLocalhost: false,
    maxBodyBytes: 26_214_400,
    fileUploadsEnabled: true,
    successRedirectUrl: "https://acme.example.com/careers/applied",
    retentionDaysOverride: 365,
    createdAt: daysAgo(14),
    updatedAt: hoursAgo(6),
    fields: [
      { id: "ff-7", name: "full_name", label: "Full Name", type: "text", required: true, position: 0, isInternal: false, isSensitive: false },
      { id: "ff-8", name: "email", label: "Email", type: "email", required: true, position: 1, isInternal: false, isSensitive: false },
      { id: "ff-9", name: "resume", label: "Resume (PDF)", type: "file", required: true, position: 2, isInternal: false, isSensitive: false },
      { id: "ff-10", name: "linkedin_url", label: "LinkedIn URL", type: "url", required: false, position: 3, isInternal: false, isSensitive: false },
    ],
    domains: [
      { id: "fd-4", host: "acme.example.com", includeSubdomains: false, isPreviewDomain: false, note: null },
    ],
  },
  {
    id: "form-004",
    publicId: "fm_eF9gH0iJ1kL2mN3oP4qR5",
    name: "Product Feedback",
    websiteUrl: null,
    status: "paused",
    healthStatus: "paused",
    submissionCount: 56,
    spamBlockedCount: 2,
    lastSubmissionAt: daysAgo(7),
    captchaEnabled: false,
    enforceOrigin: false,
    honeypotFieldName: null,
    allowLocalhost: true,
    maxBodyBytes: 1_048_576,
    fileUploadsEnabled: false,
    successRedirectUrl: null,
    retentionDaysOverride: null,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(7),
    fields: [
      { id: "ff-11", name: "rating", label: "Rating (1-5)", type: "number", required: true, position: 0, isInternal: false, isSensitive: false },
      { id: "ff-12", name: "feedback", label: "Feedback", type: "textarea", required: false, position: 1, isInternal: false, isSensitive: false },
    ],
    domains: [],
  },
];

const FIXTURE_SUBMISSIONS: SubmissionSummary[] = [
  {
    id: "sub-001",
    publicId: "sub_aA1bB2cC3dD4eE5fF6gG7",
    formId: "form-001",
    formName: "Contact Us",
    status: "new",
    origin: "live",
    spamVerdict: "clean",
    spamScore: 0.04,
    countryCode: "US",
    referrer: "https://google.com",
    processingMs: 143,
    createdAt: minutesAgo(14),
    readAt: null,
    previewFields: [
      { name: "name", value: "Alice Johnson" },
      { name: "email", value: "alice@example.com" },
    ],
  },
  {
    id: "sub-002",
    publicId: "sub_hH8iI9jJ0kK1lL2mM3nN4",
    formId: "form-002",
    formName: "Newsletter Signup",
    status: "read",
    origin: "live",
    spamVerdict: "clean",
    spamScore: 0.01,
    countryCode: "GB",
    referrer: null,
    processingMs: 89,
    createdAt: hoursAgo(1),
    readAt: hoursAgo(1),
    previewFields: [
      { name: "email", value: "bob@example.co.uk" },
      { name: "first_name", value: "Bob" },
    ],
  },
  {
    id: "sub-003",
    publicId: "sub_oO5pP6qQ7rR8sS9tT0uU1",
    formId: "form-001",
    formName: "Contact Us",
    status: "new",
    origin: "live",
    spamVerdict: "spam",
    spamScore: 0.92,
    countryCode: "CN",
    referrer: null,
    processingMs: 67,
    createdAt: hoursAgo(3),
    readAt: null,
    previewFields: [
      { name: "name", value: "Buy cheap meds" },
      { name: "email", value: "spam@nowhere.invalid" },
    ],
  },
  {
    id: "sub-004",
    publicId: "sub_vV2wW3xX4yY5zA6aB7bC8",
    formId: "form-003",
    formName: "Job Application",
    status: "read",
    origin: "live",
    spamVerdict: "clean",
    spamScore: 0.07,
    countryCode: "CA",
    referrer: "https://linkedin.com",
    processingMs: 312,
    createdAt: daysAgo(1),
    readAt: daysAgo(1),
    previewFields: [
      { name: "full_name", value: "Carol Smith" },
      { name: "email", value: "carol@example.ca" },
    ],
  },
  {
    id: "sub-005",
    publicId: "sub_cC9dD0eE1fF2gG3hH4iI5",
    formId: "form-002",
    formName: "Newsletter Signup",
    status: "archived",
    origin: "live",
    spamVerdict: "suspect",
    spamScore: 0.61,
    countryCode: "DE",
    referrer: null,
    processingMs: 98,
    createdAt: daysAgo(2),
    readAt: daysAgo(2),
    previewFields: [
      { name: "email", value: "test123@mailnull.com" },
    ],
  },
];

const FIXTURE_SUBMISSION_DETAIL: SubmissionDetail = {
  id: "sub-001",
  publicId: "sub_aA1bB2cC3dD4eE5fF6gG7",
  formId: "form-001",
  formName: "Contact Us",
  requestId: "req_zZ9yY8xX7wW6vV5uU4tT3",
  status: "new",
  origin: "live",
  data: {
    name: "Alice Johnson",
    email: "alice@example.com",
    message: "Hi, I'd like to learn more about your enterprise plan pricing. We have a team of 50 developers.",
  },
  unexpectedData: null,
  schemaVersionId: "sv-001",
  spamVerdict: "clean",
  spamScore: 0.04,
  spamSignals: [
    { code: "honeypot_empty", label: "Honeypot field empty", weight: -0.1, evidence: undefined },
    { code: "email_domain_age", label: "Email domain age > 2 years", weight: -0.05, evidence: "example.com registered 1995" },
  ],
  ipAddress: "203.0.113.0",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  referrer: "https://google.com/search?q=enterprise+forms",
  originHeader: "https://acme.example.com",
  countryCode: "US",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "enterprise-q4",
  utmTerm: null,
  utmContent: null,
  assignedToUserId: null,
  assignedToName: null,
  processingMs: 143,
  createdAt: minutesAgo(14),
  updatedAt: minutesAgo(14),
  readAt: null,
  deletedAt: null,
  events: [
    { id: "ev-1", kind: "ingestion.received", message: "Request received at ingestion edge", durationMs: 12, createdAt: new Date(Date.now() - 14 * 60 * 1000 - 143) },
    { id: "ev-2", kind: "spam.evaluated", message: "Spam check passed (score 0.04)", durationMs: 28, createdAt: new Date(Date.now() - 14 * 60 * 1000 - 131) },
    { id: "ev-3", kind: "submission.stored", message: "Submission persisted to database", durationMs: 34, createdAt: new Date(Date.now() - 14 * 60 * 1000 - 103) },
    { id: "ev-4", kind: "notification.email.sent", message: "Email notification delivered", durationMs: 69, createdAt: new Date(Date.now() - 14 * 60 * 1000 - 69) },
  ],
  files: [],
  notes: [],
  tags: ["enterprise-lead", "priority"],
  emailStatus: "sent",
  webhookStatus: null,
};

const FIXTURE_ACTIVITY: ActivityEvent[] = [
  { id: "act-1", kind: "submission_received", message: "New submission on Contact Us", formName: "Contact Us", createdAt: minutesAgo(14) },
  { id: "act-2", kind: "spam_blocked", message: "Spam submission blocked", formName: "Contact Us", createdAt: hoursAgo(3) },
  { id: "act-3", kind: "submission_received", message: "New subscription", formName: "Newsletter Signup", createdAt: hoursAgo(5) },
  { id: "act-4", kind: "health_incident", message: "Health monitor failing — Job Application form unreachable", formName: "Job Application", createdAt: daysAgo(3) },
  { id: "act-5", kind: "submission_received", message: "New job application", formName: "Job Application", createdAt: daysAgo(3) },
  { id: "act-6", kind: "form_created", message: "Form created", formName: "Product Feedback", createdAt: daysAgo(7) },
];

// ---------------------------------------------------------------------------
// Public async fixture functions
// ---------------------------------------------------------------------------

/** Fixture: overview metrics for the workspace dashboard. */
export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  return {
    submissionsToday: 37,
    submissionsThisMonth: 1_284,
    spamBlockedThisMonth: 508,
    activeForms: 3,
    formsHealthy: 1,
    failedDeliveries: 4,
    avgProcessingMs: 148,
    plan: "pro",
    submissionsUsed: 1_284,
    submissionsQuota: 10_000,
    formsUsed: 4,
    formsQuota: 50,
    recentActivity: FIXTURE_ACTIVITY,
    latestSubmissions: FIXTURE_SUBMISSIONS.slice(0, 5),
    formHealthSummary: FIXTURE_FORMS.map((f) => ({
      id: f.id,
      name: f.name,
      healthStatus: f.healthStatus,
      lastSubmissionAt: f.lastSubmissionAt,
    })),
  };
}

/** Fixture: paginated form list. */
export async function listForms(): Promise<FormSummary[]> {
  return FIXTURE_FORMS.map(
    ({ fields: _f, domains: _d, ...rest }) => rest,
  );
}

/** Fixture: single form detail. */
export async function getForm(id: string): Promise<FormDetail | null> {
  return FIXTURE_FORMS.find((f) => f.id === id) ?? null;
}

/** Fixture: paginated submission list with optional filters. */
export async function listSubmissions(opts?: {
  formId?: string;
  status?: SubmissionStatus;
  spamVerdict?: SpamVerdict;
  search?: string;
}): Promise<SubmissionSummary[]> {
  let results = [...FIXTURE_SUBMISSIONS];
  if (opts?.formId) results = results.filter((s) => s.formId === opts.formId);
  if (opts?.status) results = results.filter((s) => s.status === opts.status);
  if (opts?.spamVerdict) results = results.filter((s) => s.spamVerdict === opts.spamVerdict);
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    results = results.filter((s) =>
      s.previewFields.some((pf) => pf.value.toLowerCase().includes(q)) ||
      s.formName.toLowerCase().includes(q),
    );
  }
  return results;
}

/** Fixture: single submission detail. */
export async function getSubmission(id: string): Promise<SubmissionDetail | null> {
  if (id === FIXTURE_SUBMISSION_DETAIL.id) return FIXTURE_SUBMISSION_DETAIL;
  const summary = FIXTURE_SUBMISSIONS.find((s) => s.id === id);
  if (!summary) return null;
  // Return a minimal detail record for other fixture submissions
  return {
    ...FIXTURE_SUBMISSION_DETAIL,
    id: summary.id,
    publicId: summary.publicId,
    formId: summary.formId,
    formName: summary.formName,
    status: summary.status,
    origin: summary.origin,
    spamVerdict: summary.spamVerdict,
    spamScore: summary.spamScore,
    data: Object.fromEntries(
      summary.previewFields.map((pf) => [pf.name, pf.value]),
    ),
    createdAt: summary.createdAt,
    updatedAt: summary.createdAt,
    readAt: summary.readAt,
    countryCode: summary.countryCode,
    referrer: summary.referrer,
    processingMs: summary.processingMs,
    tags: [],
    notes: [],
    files: [],
  };
}
