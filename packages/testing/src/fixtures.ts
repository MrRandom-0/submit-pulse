/**
 * Fixture builders for Submit Pulse tests.
 *
 * Column names match the real Drizzle schema in packages/database/src/schema/.
 * Do NOT rename fields here without updating the corresponding schema file.
 *
 * These builders produce plain JS objects — they do NOT write to any database.
 * They are intended for use in unit and integration tests where the code under
 * test accepts typed values rather than live DB rows.
 */

import type { Actor } from "@submitpulse/auth/permissions";
import type { WorkspaceRole } from "@submitpulse/auth/permissions";
import { seededRandom } from "./random.js";

// ---------------------------------------------------------------------------
// Opaque ID helpers
// ---------------------------------------------------------------------------

/** Counter-based deterministic UUID-shaped string (not a real UUID v4). */
function fakeUuid(seed: number): string {
  const hex = seed.toString(16).padStart(8, "0");
  return `${hex}-0000-4000-8000-000000000000`;
}

/** Well-formed public form ID matching the DB check constraint ^fm_[A-Za-z0-9]{22,}$ */
function fakePublicFormId(seed: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const rng = seededRandom(seed);
  let s = "fm_";
  for (let i = 0; i < 22; i++) {
    s += chars[Math.floor(rng() * chars.length)];
  }
  return s;
}

// ---------------------------------------------------------------------------
// Counter for monotonically increasing IDs within a test run.
// Tests that need repeatable IDs should call with an explicit seed.
// ---------------------------------------------------------------------------

let _counter = 0;
function nextSeed(): number {
  return ++_counter;
}

// ---------------------------------------------------------------------------
// Workspace fixture
// ---------------------------------------------------------------------------

export interface WorkspaceFixture {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly kind: "standard" | "client";
  readonly parentWorkspaceId: string | null;
  readonly plan: "free" | "starter" | "pro" | "agency";
  readonly suspendedAt: Date | null;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WorkspaceFixtureOverrides {
  id?: string;
  slug?: string;
  name?: string;
  kind?: WorkspaceFixture["kind"];
  parentWorkspaceId?: string | null;
  plan?: WorkspaceFixture["plan"];
  suspendedAt?: Date | null;
  deletedAt?: Date | null;
}

export function makeWorkspace(
  overrides: WorkspaceFixtureOverrides = {},
): WorkspaceFixture {
  const seed = nextSeed();
  const now = new Date("2025-01-15T12:00:00Z");
  return {
    id: fakeUuid(seed),
    slug: `workspace-${seed}`,
    name: `Test Workspace ${seed}`,
    kind: "standard",
    parentWorkspaceId: null,
    plan: "free",
    suspendedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// User fixture
// ---------------------------------------------------------------------------

export interface UserFixture {
  readonly id: string;
  readonly authProviderId: string;
  readonly email: string;
  readonly emailVerifiedAt: Date | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly isPlatformAdmin: boolean;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UserFixtureOverrides {
  id?: string;
  authProviderId?: string;
  email?: string;
  emailVerifiedAt?: Date | null;
  displayName?: string | null;
  isPlatformAdmin?: boolean;
  deletedAt?: Date | null;
}

export function makeUser(overrides: UserFixtureOverrides = {}): UserFixture {
  const seed = nextSeed();
  const now = new Date("2025-01-15T12:00:00Z");
  return {
    id: fakeUuid(seed),
    authProviderId: `auth_${seed}`,
    email: `user${seed}@example.com`,
    emailVerifiedAt: now,
    displayName: `Test User ${seed}`,
    avatarUrl: null,
    isPlatformAdmin: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Form fixture
// ---------------------------------------------------------------------------

export interface FormFixture {
  readonly id: string;
  readonly workspaceId: string;
  readonly publicId: string;
  readonly name: string;
  readonly websiteUrl: string | null;
  readonly status: "active" | "paused" | "archived";
  readonly healthStatus: "healthy" | "degraded" | "down" | "setup_incomplete";
  readonly captchaEnabled: boolean;
  readonly honeypotFieldName: string | null;
  readonly enforceOrigin: boolean;
  readonly allowLocalhost: boolean;
  readonly maxBodyBytes: number;
  readonly fileUploadsEnabled: boolean;
  readonly successRedirectUrl: string | null;
  readonly submissionCount: number;
  readonly spamBlockedCount: number;
  readonly lastSubmissionAt: Date | null;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FormFixtureOverrides {
  id?: string;
  workspaceId?: string;
  publicId?: string;
  name?: string;
  websiteUrl?: string | null;
  status?: FormFixture["status"];
  healthStatus?: FormFixture["healthStatus"];
  captchaEnabled?: boolean;
  honeypotFieldName?: string | null;
  enforceOrigin?: boolean;
  allowLocalhost?: boolean;
  maxBodyBytes?: number;
  fileUploadsEnabled?: boolean;
  successRedirectUrl?: string | null;
  deletedAt?: Date | null;
}

export function makeForm(overrides: FormFixtureOverrides = {}): FormFixture {
  const seed = nextSeed();
  const now = new Date("2025-01-15T12:00:00Z");
  return {
    id: fakeUuid(seed),
    workspaceId: fakeUuid(seed + 1000),
    publicId: fakePublicFormId(seed),
    name: `Test Form ${seed}`,
    websiteUrl: null,
    status: "active",
    healthStatus: "setup_incomplete",
    captchaEnabled: false,
    honeypotFieldName: null,
    enforceOrigin: false,
    allowLocalhost: true,
    maxBodyBytes: 1_048_576,
    fileUploadsEnabled: false,
    successRedirectUrl: null,
    submissionCount: 0,
    spamBlockedCount: 0,
    lastSubmissionAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Submission fixture
// ---------------------------------------------------------------------------

export interface SubmissionFixture {
  readonly id: string;
  readonly workspaceId: string;
  readonly formId: string;
  readonly publicId: string;
  readonly requestId: string;
  readonly idempotencyKey: string | null;
  readonly status: "new" | "read" | "spam" | "archived" | "deleted";
  readonly origin: "live" | "test" | "synthetic";
  readonly data: Record<string, unknown>;
  readonly unexpectedData: Record<string, unknown> | null;
  readonly schemaVersionId: string | null;
  readonly spamVerdict: "clean" | "suspicious" | "spam" | "blocked";
  readonly spamScore: number;
  readonly ipAddress: string | null;
  readonly fingerprint: string | null;
  readonly userAgent: string | null;
  readonly referrer: string | null;
  readonly originHeader: string | null;
  readonly countryCode: string | null;
  readonly processingMs: number | null;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SubmissionFixtureOverrides {
  id?: string;
  workspaceId?: string;
  formId?: string;
  publicId?: string;
  requestId?: string;
  idempotencyKey?: string | null;
  status?: SubmissionFixture["status"];
  origin?: SubmissionFixture["origin"];
  data?: Record<string, unknown>;
  unexpectedData?: Record<string, unknown> | null;
  spamVerdict?: SubmissionFixture["spamVerdict"];
  spamScore?: number;
  ipAddress?: string | null;
  countryCode?: string | null;
  deletedAt?: Date | null;
}

export function makeSubmission(
  overrides: SubmissionFixtureOverrides = {},
): SubmissionFixture {
  const seed = nextSeed();
  const now = new Date("2025-01-15T12:00:00Z");
  return {
    id: fakeUuid(seed),
    workspaceId: fakeUuid(seed + 2000),
    formId: fakeUuid(seed + 3000),
    publicId: `sub_${seed.toString(16).padStart(22, "0")}`,
    requestId: `req_${seed}`,
    idempotencyKey: null,
    status: "new",
    origin: "live",
    data: { name: `Test User ${seed}`, email: `user${seed}@example.com` },
    unexpectedData: null,
    schemaVersionId: null,
    spamVerdict: "clean",
    spamScore: 0,
    ipAddress: "203.0.113.1",
    fingerprint: null,
    userAgent: "Mozilla/5.0 (test)",
    referrer: null,
    originHeader: "https://example.com",
    countryCode: "US",
    processingMs: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
