import { brand } from "@submitpulse/config";

/**
 * Fixture operator identity used by admin action stubs.
 *
 * Derived from the brand module rather than hardcoded so that renaming the
 * product does not leave a stale domain in audit-log fixtures. `pnpm
 * brand:verify` fails the build on a hardcoded literal here.
 */
export const FIXTURE_OPS_EMAIL = `ops@${brand.domains.apex}`;

/**
 * DEVELOPMENT FIXTURES — not production data. Replace with real Drizzle queries.
 * Column names match the real schema in packages/database/src/schema/platform.ts.
 *
 * SECURITY NOTE: This module deliberately never returns submission field values.
 * Admin views are metadata-only. Content access requires explicit escalation via
 * RequestContentAccess. See the admin routes for enforcement details.
 */

// ---------------------------------------------------------------------------
// Shared types (mirroring pg enums)
// ---------------------------------------------------------------------------

export type JobStatus = "pending" | "running" | "completed" | "failed" | "dead_lettered";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid";
export type PlanId = "free" | "starter" | "pro" | "enterprise";
export type SecurityEventKind =
  | "login_failed"
  | "password_changed"
  | "mfa_disabled"
  | "api_key_created"
  | "api_key_revoked"
  | "workspace_suspended"
  | "suspicious_activity";
export type ActorType = "user" | "api_key" | "system" | "support";
export type WorkspaceStatus = "active" | "suspended" | "pending_deletion";
export type FormAdminStatus = "active" | "paused" | "archived";

// ---------------------------------------------------------------------------
// View-model types matching schema column names
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: Date;
  lastSignInAt: Date | null;
  workspaceCount: number;
  isPlatformAdmin: boolean;
  suspended: boolean;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  plan: PlanId;
  subscriptionStatus: SubscriptionStatus;
  formCount: number;
  submissionCount: number;
  memberCount: number;
  status: WorkspaceStatus;
  createdAt: Date;
  lastActivityAt: Date | null;
}

export interface AdminFormSummary {
  id: string;
  publicId: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  status: FormAdminStatus;
  submissionCount: number;
  spamBlockedCount: number;
  lastSubmissionAt: Date | null;
  createdAt: Date;
  /** Failure rate over the last 24 h (0–1). */
  failureRate24h: number;
}

export interface AdminSubscription {
  id: string;
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  plan: PlanId;
  status: SubscriptionStatus;
  /** Stripe customer id — prefix only, never full id in UI to reduce blast radius. */
  stripeCustomerPrefix: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  seats: number;
  mrr: number; // monthly recurring revenue in cents
  createdAt: Date;
}

export interface AdminUsageSummary {
  workspaceId: string;
  workspaceName: string;
  plan: PlanId;
  billingPeriodStart: Date;
  submissionsAccepted: number;
  submissionsQuota: number | null;
  emailDelivered: number;
  webhookAttempts: number;
  storageBytes: number;
  aiAnalyses: number;
}

export interface AdminSecurityEvent {
  id: string;
  workspaceId: string | null;
  userId: string | null;
  userEmail: string | null;
  kind: SecurityEventKind;
  severity: "info" | "warning" | "critical";
  ipAddress: string | null;
  /** User-agent family only — never expose full UA string to avoid fingerprinting logs. */
  uaFamily: string | null;
  createdAt: Date;
}

export interface AdminAbuseSignal {
  id: string;
  workspaceId: string;
  workspaceName: string;
  signal: string;
  severity: "low" | "medium" | "high";
  detail: string;
  createdAt: Date;
  resolved: boolean;
}

export interface AdminJob {
  id: string;
  queue: string;
  jobType: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  workspaceId: string | null;
  workspaceName: string | null;
  durationMs: number | null;
  lastError: string | null;
  deadLetteredAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
}

export interface AdminFeatureFlag {
  id: string;
  key: string;
  description: string | null;
  enabledGlobally: boolean;
  rolloutPercent: number;
  enabledWorkspaceIds: string[];
  updatedByUserEmail: string | null;
  updatedAt: Date;
  createdAt: Date;
}

export interface AdminAuditEntry {
  id: string;
  workspaceId: string;
  workspaceName: string;
  actorUserId: string | null;
  actorLabel: string | null;
  actorType: ActorType;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

export interface AdminApiKey {
  id: string;
  workspaceId: string;
  workspaceName: string;
  name: string;
  keyPrefix: string | null;
  createdByEmail: string | null;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface AdminEmailDelivery {
  id: string;
  workspaceId: string;
  workspaceName: string;
  formName: string;
  recipientDomain: string; // domain only, never full address in admin views
  status: "sent" | "failed" | "bounced" | "deferred";
  attempts: number;
  errorCode: string | null;
  createdAt: Date;
}

export interface AdminWebhookDelivery {
  id: string;
  workspaceId: string;
  workspaceName: string;
  formName: string;
  /** Target URL host only — do not expose full webhook URL (may contain secrets in query strings). */
  targetHost: string;
  status: "delivered" | "failed" | "pending";
  httpStatus: number | null;
  attempts: number;
  durationMs: number | null;
  createdAt: Date;
}

export interface AdminIncident {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  impact: "none" | "minor" | "major" | "critical";
  affectedComponents: string[];
  createdAt: Date;
  resolvedAt: Date | null;
  updates: Array<{
    id: string;
    message: string;
    status: string;
    createdAt: Date;
  }>;
}

export interface PlatformOverview {
  totalWorkspaces: number;
  activeWorkspaces: number;
  suspendedWorkspaces: number;
  totalForms: number;
  submissionsToday: number;
  submissionsThisMonth: number;
  deadLetteredJobs: number;
  openIncidents: number;
  mrr: number;
  newWorkspacesToday: number;
  securityEventsLast24h: number;
  avgProcessingMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
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

const FIXTURE_USERS: AdminUser[] = [
  {
    id: "usr-001",
    email: "alice@acme.example.com",
    fullName: "Alice Johnson",
    avatarUrl: null,
    emailVerified: true,
    createdAt: daysAgo(92),
    lastSignInAt: hoursAgo(2),
    workspaceCount: 2,
    isPlatformAdmin: false,
    suspended: false,
  },
  {
    id: "usr-002",
    email: "bob@widgets.example.com",
    fullName: "Bob Smith",
    avatarUrl: null,
    emailVerified: true,
    createdAt: daysAgo(60),
    lastSignInAt: daysAgo(1),
    workspaceCount: 1,
    isPlatformAdmin: false,
    suspended: false,
  },
  {
    id: "usr-003",
    email: "carol@globex.example.com",
    fullName: "Carol Nguyen",
    avatarUrl: null,
    emailVerified: false,
    createdAt: daysAgo(3),
    lastSignInAt: null,
    workspaceCount: 1,
    isPlatformAdmin: false,
    suspended: false,
  },
  {
    id: "usr-004",
    email: "spammer@nowhere.invalid",
    fullName: null,
    avatarUrl: null,
    emailVerified: false,
    createdAt: daysAgo(1),
    lastSignInAt: daysAgo(1),
    workspaceCount: 1,
    isPlatformAdmin: false,
    suspended: true,
  },
  {
    id: "usr-005",
    email: FIXTURE_OPS_EMAIL,
    fullName: "Ops Admin",
    avatarUrl: null,
    emailVerified: true,
    createdAt: daysAgo(200),
    lastSignInAt: hoursAgo(1),
    workspaceCount: 0,
    isPlatformAdmin: true,
    suspended: false,
  },
];

const FIXTURE_WORKSPACES: AdminWorkspace[] = [
  {
    id: "ws-001",
    name: "Acme Corp",
    slug: "acme-corp",
    ownerEmail: "alice@acme.example.com",
    plan: "pro",
    subscriptionStatus: "active",
    formCount: 4,
    submissionCount: 5_439,
    memberCount: 3,
    status: "active",
    createdAt: daysAgo(92),
    lastActivityAt: minutesAgo(14),
  },
  {
    id: "ws-002",
    name: "Widgets Inc",
    slug: "widgets-inc",
    ownerEmail: "bob@widgets.example.com",
    plan: "starter",
    subscriptionStatus: "active",
    formCount: 1,
    submissionCount: 210,
    memberCount: 1,
    status: "active",
    createdAt: daysAgo(60),
    lastActivityAt: daysAgo(1),
  },
  {
    id: "ws-003",
    name: "Globex Industries",
    slug: "globex-industries",
    ownerEmail: "carol@globex.example.com",
    plan: "free",
    subscriptionStatus: "active",
    formCount: 0,
    submissionCount: 0,
    memberCount: 1,
    status: "active",
    createdAt: daysAgo(3),
    lastActivityAt: daysAgo(3),
  },
  {
    id: "ws-004",
    name: "BadActor LLC",
    slug: "badactor-llc",
    ownerEmail: "spammer@nowhere.invalid",
    plan: "free",
    subscriptionStatus: "active",
    formCount: 12,
    submissionCount: 90_000,
    memberCount: 1,
    status: "suspended",
    createdAt: daysAgo(1),
    lastActivityAt: hoursAgo(8),
  },
];

const FIXTURE_FORMS: AdminFormSummary[] = [
  {
    id: "form-001",
    publicId: "fm_aB3xK9mNpQ7rS2tU8vW4yZ",
    name: "Contact Us",
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    status: "active",
    submissionCount: 1_247,
    spamBlockedCount: 83,
    lastSubmissionAt: minutesAgo(14),
    createdAt: daysAgo(42),
    failureRate24h: 0.0,
  },
  {
    id: "form-002",
    publicId: "fm_cD5eF6gH7iJ8kL9mN0oP1",
    name: "Newsletter Signup",
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    status: "active",
    submissionCount: 3_891,
    spamBlockedCount: 412,
    lastSubmissionAt: hoursAgo(2),
    createdAt: daysAgo(90),
    failureRate24h: 0.12,
  },
  {
    id: "form-003",
    publicId: "fm_qR2sT3uV4wX5yZ6aB7cD8",
    name: "Job Application",
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    status: "active",
    submissionCount: 204,
    spamBlockedCount: 11,
    lastSubmissionAt: daysAgo(3),
    createdAt: daysAgo(14),
    failureRate24h: 0.88,
  },
  {
    id: "form-004",
    publicId: "fm_eF9gH0iJ1kL2mN3oP4qR5",
    name: "Product Feedback",
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    status: "paused",
    submissionCount: 56,
    spamBlockedCount: 2,
    lastSubmissionAt: daysAgo(7),
    createdAt: daysAgo(30),
    failureRate24h: 0.0,
  },
  {
    id: "form-005",
    publicId: "fm_gH1iI2jJ3kK4lL5mM6nN7",
    name: "Quote Request",
    workspaceId: "ws-002",
    workspaceName: "Widgets Inc",
    status: "active",
    submissionCount: 210,
    spamBlockedCount: 5,
    lastSubmissionAt: daysAgo(1),
    createdAt: daysAgo(60),
    failureRate24h: 0.02,
  },
];

const FIXTURE_SUBSCRIPTIONS: AdminSubscription[] = [
  {
    id: "sub-001",
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    ownerEmail: "alice@acme.example.com",
    plan: "pro",
    status: "active",
    stripeCustomerPrefix: "cus_Nx4a",
    currentPeriodEnd: daysAgo(-15),
    cancelAtPeriodEnd: false,
    seats: 3,
    mrr: 7900,
    createdAt: daysAgo(92),
  },
  {
    id: "sub-002",
    workspaceId: "ws-002",
    workspaceName: "Widgets Inc",
    ownerEmail: "bob@widgets.example.com",
    plan: "starter",
    status: "active",
    stripeCustomerPrefix: "cus_Mx3b",
    currentPeriodEnd: daysAgo(-8),
    cancelAtPeriodEnd: true,
    seats: 1,
    mrr: 2900,
    createdAt: daysAgo(60),
  },
  {
    id: "sub-003",
    workspaceId: "ws-003",
    workspaceName: "Globex Industries",
    ownerEmail: "carol@globex.example.com",
    plan: "free",
    status: "active",
    stripeCustomerPrefix: "cus_Ly2c",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    seats: 1,
    mrr: 0,
    createdAt: daysAgo(3),
  },
];

const FIXTURE_JOBS: AdminJob[] = [
  {
    id: "job-001",
    queue: "email",
    jobType: "send_notification",
    status: "completed",
    attempts: 1,
    maxAttempts: 5,
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    durationMs: 342,
    lastError: null,
    deadLetteredAt: null,
    createdAt: minutesAgo(15),
    completedAt: minutesAgo(14),
    failedAt: null,
  },
  {
    id: "job-002",
    queue: "webhook",
    jobType: "deliver_webhook",
    status: "failed",
    attempts: 5,
    maxAttempts: 5,
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    durationMs: null,
    lastError: "ECONNREFUSED — remote host refused connection",
    deadLetteredAt: hoursAgo(1),
    createdAt: hoursAgo(2),
    completedAt: null,
    failedAt: hoursAgo(1),
  },
  {
    id: "job-003",
    queue: "file-scan",
    jobType: "scan_upload",
    status: "running",
    attempts: 1,
    maxAttempts: 3,
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    durationMs: null,
    lastError: null,
    deadLetteredAt: null,
    createdAt: minutesAgo(2),
    completedAt: null,
    failedAt: null,
  },
  {
    id: "job-004",
    queue: "webhook",
    jobType: "deliver_webhook",
    status: "dead_lettered",
    attempts: 5,
    maxAttempts: 5,
    workspaceId: "ws-002",
    workspaceName: "Widgets Inc",
    durationMs: null,
    lastError: "HTTP 502 — gateway error after 3 retries",
    deadLetteredAt: daysAgo(1),
    createdAt: daysAgo(1),
    completedAt: null,
    failedAt: daysAgo(1),
  },
  {
    id: "job-005",
    queue: "metering",
    jobType: "flush_usage_events",
    status: "pending",
    attempts: 0,
    maxAttempts: 5,
    workspaceId: null,
    workspaceName: null,
    durationMs: null,
    lastError: null,
    deadLetteredAt: null,
    createdAt: minutesAgo(1),
    completedAt: null,
    failedAt: null,
  },
];

const FIXTURE_FEATURE_FLAGS: AdminFeatureFlag[] = [
  {
    id: "ff-001",
    key: "ai_repair_v2",
    description: "Enable next-gen AI schema repair suggestions",
    enabledGlobally: false,
    rolloutPercent: 10,
    enabledWorkspaceIds: ["ws-001"],
    updatedByUserEmail: FIXTURE_OPS_EMAIL,
    updatedAt: daysAgo(2),
    createdAt: daysAgo(10),
  },
  {
    id: "ff-002",
    key: "bulk_export_zip",
    description: "Allow bulk ZIP export of submissions",
    enabledGlobally: true,
    rolloutPercent: 100,
    enabledWorkspaceIds: [],
    updatedByUserEmail: FIXTURE_OPS_EMAIL,
    updatedAt: daysAgo(5),
    createdAt: daysAgo(20),
  },
  {
    id: "ff-003",
    key: "new_spam_model_v3",
    description: "Experimental spam detection model v3 (higher precision)",
    enabledGlobally: false,
    rolloutPercent: 5,
    enabledWorkspaceIds: [],
    updatedByUserEmail: null,
    updatedAt: daysAgo(1),
    createdAt: daysAgo(1),
  },
  {
    id: "ff-004",
    key: "agency_sub_workspaces",
    description: "Agency plan sub-workspace creation",
    enabledGlobally: false,
    rolloutPercent: 0,
    enabledWorkspaceIds: ["ws-001", "ws-002"],
    updatedByUserEmail: FIXTURE_OPS_EMAIL,
    updatedAt: daysAgo(14),
    createdAt: daysAgo(30),
  },
];

const FIXTURE_AUDIT_ENTRIES: AdminAuditEntry[] = [
  {
    id: "al-001",
    workspaceId: "ws-004",
    workspaceName: "BadActor LLC",
    actorUserId: "usr-005",
    actorLabel: FIXTURE_OPS_EMAIL,
    actorType: "support",
    action: "workspace.suspended",
    resourceType: "workspace",
    resourceId: "ws-004",
    ipAddress: "198.51.100.1",
    createdAt: hoursAgo(8),
  },
  {
    id: "al-002",
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    actorUserId: null,
    actorLabel: "flush_usage_events",
    actorType: "system",
    action: "usage.flushed",
    resourceType: "usage_event",
    resourceId: null,
    ipAddress: null,
    createdAt: minutesAgo(30),
  },
  {
    id: "al-003",
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    actorUserId: "usr-005",
    actorLabel: FIXTURE_OPS_EMAIL,
    actorType: "support",
    action: "api_key.revoked",
    resourceType: "api_key",
    resourceId: "key-009",
    ipAddress: "198.51.100.1",
    createdAt: daysAgo(1),
  },
  {
    id: "al-004",
    workspaceId: "ws-002",
    workspaceName: "Widgets Inc",
    actorUserId: "usr-005",
    actorLabel: FIXTURE_OPS_EMAIL,
    actorType: "support",
    action: "credits.granted",
    resourceType: "subscription",
    resourceId: "sub-002",
    ipAddress: "198.51.100.1",
    createdAt: daysAgo(2),
  },
];

const FIXTURE_SECURITY_EVENTS: AdminSecurityEvent[] = [
  {
    id: "se-001",
    workspaceId: null,
    userId: null,
    userEmail: "attacker@nowhere.invalid",
    kind: "login_failed",
    severity: "warning",
    ipAddress: "192.0.2.100",
    uaFamily: "Python-requests",
    createdAt: minutesAgo(5),
  },
  {
    id: "se-002",
    workspaceId: "ws-004",
    userId: "usr-004",
    userEmail: "spammer@nowhere.invalid",
    kind: "suspicious_activity",
    severity: "critical",
    ipAddress: "198.18.0.55",
    uaFamily: "curl",
    createdAt: hoursAgo(8),
  },
  {
    id: "se-003",
    workspaceId: "ws-001",
    userId: "usr-001",
    userEmail: "alice@acme.example.com",
    kind: "api_key_created",
    severity: "info",
    ipAddress: "203.0.113.5",
    uaFamily: "Chrome",
    createdAt: daysAgo(1),
  },
];

const FIXTURE_ABUSE_SIGNALS: AdminAbuseSignal[] = [
  {
    id: "ab-001",
    workspaceId: "ws-004",
    workspaceName: "BadActor LLC",
    signal: "submission_volume_spike",
    severity: "high",
    detail: "90,000 submissions in 24 hours — 180x above plan quota",
    createdAt: hoursAgo(10),
    resolved: false,
  },
  {
    id: "ab-002",
    workspaceId: "ws-004",
    workspaceName: "BadActor LLC",
    signal: "disposable_email_concentration",
    severity: "high",
    detail: "94% of submissions used disposable email domains",
    createdAt: hoursAgo(10),
    resolved: false,
  },
  {
    id: "ab-003",
    workspaceId: "ws-002",
    workspaceName: "Widgets Inc",
    signal: "repeated_webhook_failures",
    severity: "medium",
    detail: "Webhook endpoint returned 502 on 47 consecutive deliveries",
    createdAt: daysAgo(1),
    resolved: false,
  },
];

const FIXTURE_INCIDENTS: AdminIncident[] = [
  {
    id: "inc-001",
    title: "Elevated webhook delivery latency",
    status: "monitoring",
    impact: "minor",
    affectedComponents: ["webhooks"],
    createdAt: hoursAgo(3),
    resolvedAt: null,
    updates: [
      {
        id: "iu-001",
        message: "We have identified the root cause as a misconfigured retry backoff. A fix has been deployed. We continue to monitor.",
        status: "monitoring",
        createdAt: hoursAgo(1),
      },
      {
        id: "iu-002",
        message: "Investigating elevated p99 latency on webhook delivery queue.",
        status: "investigating",
        createdAt: hoursAgo(3),
      },
    ],
  },
  {
    id: "inc-002",
    title: "File upload processing delays",
    status: "resolved",
    impact: "minor",
    affectedComponents: ["file processing"],
    createdAt: daysAgo(7),
    resolvedAt: daysAgo(7),
    updates: [
      {
        id: "iu-003",
        message: "Processing backlog cleared. All queued uploads have been scanned.",
        status: "resolved",
        createdAt: daysAgo(7),
      },
    ],
  },
];

const FIXTURE_API_KEYS: AdminApiKey[] = [
  {
    id: "key-001",
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    name: "Production",
    keyPrefix: "submitpulse_live_a1b2",
    createdByEmail: "alice@acme.example.com",
    lastUsedAt: minutesAgo(20),
    lastUsedIp: "203.0.113.5",
    expiresAt: null,
    revokedAt: null,
    createdAt: daysAgo(90),
  },
  {
    id: "key-002",
    workspaceId: "ws-001",
    workspaceName: "Acme Corp",
    name: "CI / Testing",
    keyPrefix: "submitpulse_test_c3d4",
    createdByEmail: "alice@acme.example.com",
    lastUsedAt: daysAgo(1),
    lastUsedIp: "10.0.0.1",
    expiresAt: daysAgo(-30),
    revokedAt: null,
    createdAt: daysAgo(30),
  },
  {
    id: "key-003",
    workspaceId: "ws-004",
    workspaceName: "BadActor LLC",
    name: "Automation",
    keyPrefix: "submitpulse_live_z9y8",
    createdByEmail: "spammer@nowhere.invalid",
    lastUsedAt: hoursAgo(8),
    lastUsedIp: "198.18.0.55",
    expiresAt: null,
    revokedAt: hoursAgo(7),
    createdAt: daysAgo(1),
  },
];

// ---------------------------------------------------------------------------
// Public async fixture functions
// ---------------------------------------------------------------------------

/** Fixture: platform-wide ops overview. */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  return {
    totalWorkspaces: 1_842,
    activeWorkspaces: 1_810,
    suspendedWorkspaces: 32,
    totalForms: 7_294,
    submissionsToday: 48_291,
    submissionsThisMonth: 1_204_837,
    deadLetteredJobs: 7,
    openIncidents: 1,
    mrr: 139_400,
    newWorkspacesToday: 14,
    securityEventsLast24h: 39,
    avgProcessingMs: 142,
  };
}

/** Fixture: paginated user list. */
export async function listAdminUsers(opts?: {
  search?: string;
  suspended?: boolean;
}): Promise<AdminUser[]> {
  let results = [...FIXTURE_USERS];
  if (opts?.suspended !== undefined)
    results = results.filter((u) => u.suspended === opts.suspended);
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    results = results.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.fullName?.toLowerCase().includes(q) ?? false),
    );
  }
  return results;
}

/** Fixture: single user. */
export async function getAdminUser(id: string): Promise<AdminUser | null> {
  return FIXTURE_USERS.find((u) => u.id === id) ?? null;
}

/** Fixture: paginated workspace list. */
export async function listAdminWorkspaces(opts?: {
  search?: string;
  status?: WorkspaceStatus;
  plan?: PlanId;
}): Promise<AdminWorkspace[]> {
  let results = [...FIXTURE_WORKSPACES];
  if (opts?.status) results = results.filter((w) => w.status === opts.status);
  if (opts?.plan) results = results.filter((w) => w.plan === opts.plan);
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    results = results.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.ownerEmail.toLowerCase().includes(q) ||
        w.slug.toLowerCase().includes(q),
    );
  }
  return results;
}

/** Fixture: single workspace. */
export async function getAdminWorkspace(
  id: string,
): Promise<AdminWorkspace | null> {
  return FIXTURE_WORKSPACES.find((w) => w.id === id) ?? null;
}

/** Fixture: admin form list. */
export async function listAdminForms(opts?: {
  workspaceId?: string;
  status?: FormAdminStatus;
}): Promise<AdminFormSummary[]> {
  let results = [...FIXTURE_FORMS];
  if (opts?.workspaceId)
    results = results.filter((f) => f.workspaceId === opts.workspaceId);
  if (opts?.status)
    results = results.filter((f) => f.status === opts.status);
  return results;
}

/** Fixture: subscription list. */
export async function listAdminSubscriptions(): Promise<AdminSubscription[]> {
  return [...FIXTURE_SUBSCRIPTIONS];
}

/** Fixture: usage summary per workspace. */
export async function listAdminUsage(): Promise<AdminUsageSummary[]> {
  return [
    {
      workspaceId: "ws-001",
      workspaceName: "Acme Corp",
      plan: "pro",
      billingPeriodStart: daysAgo(15),
      submissionsAccepted: 1_284,
      submissionsQuota: 10_000,
      emailDelivered: 1_102,
      webhookAttempts: 392,
      storageBytes: 45_678_912,
      aiAnalyses: 87,
    },
    {
      workspaceId: "ws-002",
      workspaceName: "Widgets Inc",
      plan: "starter",
      billingPeriodStart: daysAgo(8),
      submissionsAccepted: 210,
      submissionsQuota: 1_000,
      emailDelivered: 198,
      webhookAttempts: 0,
      storageBytes: 1_024_000,
      aiAnalyses: 4,
    },
  ];
}

/** Fixture: security events. */
export async function listAdminSecurityEvents(): Promise<AdminSecurityEvent[]> {
  return [...FIXTURE_SECURITY_EVENTS];
}

/** Fixture: abuse signals. */
export async function listAdminAbuseSignals(): Promise<AdminAbuseSignal[]> {
  return [...FIXTURE_ABUSE_SIGNALS];
}

/** Fixture: background jobs. */
export async function listAdminJobs(opts?: {
  status?: JobStatus;
  queue?: string;
}): Promise<AdminJob[]> {
  let results = [...FIXTURE_JOBS];
  if (opts?.status) results = results.filter((j) => j.status === opts.status);
  if (opts?.queue) results = results.filter((j) => j.queue === opts.queue);
  return results;
}

/** Fixture: feature flags. */
export async function listAdminFeatureFlags(): Promise<AdminFeatureFlag[]> {
  return [...FIXTURE_FEATURE_FLAGS];
}

/** Fixture: audit log entries. */
export async function listAdminAuditLog(opts?: {
  workspaceId?: string;
  actorType?: ActorType;
}): Promise<AdminAuditEntry[]> {
  let results = [...FIXTURE_AUDIT_ENTRIES];
  if (opts?.workspaceId)
    results = results.filter((e) => e.workspaceId === opts.workspaceId);
  if (opts?.actorType)
    results = results.filter((e) => e.actorType === opts.actorType);
  return results;
}

/** Fixture: API keys for admin review. */
export async function listAdminApiKeys(opts?: {
  workspaceId?: string;
  revoked?: boolean;
}): Promise<AdminApiKey[]> {
  let results = [...FIXTURE_API_KEYS];
  if (opts?.workspaceId)
    results = results.filter((k) => k.workspaceId === opts.workspaceId);
  if (opts?.revoked !== undefined)
    results = results.filter((k) =>
      opts.revoked ? k.revokedAt !== null : k.revokedAt === null,
    );
  return results;
}

/** Fixture: email delivery log. */
export async function listAdminEmailDeliveries(): Promise<AdminEmailDelivery[]> {
  return [
    {
      id: "em-001",
      workspaceId: "ws-001",
      workspaceName: "Acme Corp",
      formName: "Contact Us",
      recipientDomain: "acme.example.com",
      status: "sent",
      attempts: 1,
      errorCode: null,
      createdAt: minutesAgo(14),
    },
    {
      id: "em-002",
      workspaceId: "ws-001",
      workspaceName: "Acme Corp",
      formName: "Newsletter Signup",
      recipientDomain: "acme.example.com",
      status: "failed",
      attempts: 3,
      errorCode: "550 5.1.1 user unknown",
      createdAt: hoursAgo(2),
    },
    {
      id: "em-003",
      workspaceId: "ws-002",
      workspaceName: "Widgets Inc",
      formName: "Quote Request",
      recipientDomain: "widgets.example.com",
      status: "bounced",
      attempts: 1,
      errorCode: "550 5.4.1 recipient rejected",
      createdAt: daysAgo(1),
    },
  ];
}

/** Fixture: webhook delivery log. */
export async function listAdminWebhookDeliveries(): Promise<
  AdminWebhookDelivery[]
> {
  return [
    {
      id: "wh-001",
      workspaceId: "ws-001",
      workspaceName: "Acme Corp",
      formName: "Contact Us",
      targetHost: "hooks.acme.example.com",
      status: "delivered",
      httpStatus: 200,
      attempts: 1,
      durationMs: 234,
      createdAt: minutesAgo(14),
    },
    {
      id: "wh-002",
      workspaceId: "ws-001",
      workspaceName: "Acme Corp",
      formName: "Newsletter Signup",
      targetHost: "hooks.acme.example.com",
      status: "failed",
      httpStatus: 502,
      attempts: 5,
      durationMs: null,
      createdAt: hoursAgo(1),
    },
    {
      id: "wh-003",
      workspaceId: "ws-002",
      workspaceName: "Widgets Inc",
      formName: "Quote Request",
      targetHost: "api.widgets.example.com",
      status: "delivered",
      httpStatus: 200,
      attempts: 2,
      durationMs: 567,
      createdAt: daysAgo(1),
    },
  ];
}

/** Fixture: incidents. */
export async function listAdminIncidents(): Promise<AdminIncident[]> {
  return [...FIXTURE_INCIDENTS];
}

/** Fixture: single incident. */
export async function getAdminIncident(
  id: string,
): Promise<AdminIncident | null> {
  return FIXTURE_INCIDENTS.find((i) => i.id === id) ?? null;
}
