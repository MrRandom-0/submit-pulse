/**
 * Shared types for MCP tool inputs and outputs.
 * JSON Schema definitions are co-located with tool definitions in tools.ts.
 */

import type { BuilderId } from "@submitpulse/config";

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

/** Minimal form shape returned in listing calls. */
export interface FormSummary {
  formId: string;
  name: string;
  createdAt: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Tool input types (validated against JSON Schema at runtime)
// ---------------------------------------------------------------------------

export interface ListFormsInput {
  workspaceId?: string;
  limit?: number;
  cursor?: string;
}

export interface GetFormConfigInput {
  formId: string;
}

export interface GetSchemaInput {
  formId: string;
}

export interface GenerateIntegrationInput {
  formId: string;
  builderId: BuilderId;
}

export interface ValidateIntegrationInput {
  formId: string;
  /** The generated code snippet to validate. */
  code: string;
  builderId: BuilderId;
}

export interface SendTestSubmissionInput {
  formId: string;
  /** Field values for the synthetic submission. */
  fields: Record<string, string>;
}

export interface CheckFormHealthInput {
  formId: string;
}

// ---------------------------------------------------------------------------
// Tool output types
// ---------------------------------------------------------------------------

export interface FormConfig {
  formId: string;
  name: string;
  /** Public submission endpoint. Never contains submission content. */
  endpoint: string;
  allowedOrigins: string[];
  turnstileEnabled: boolean;
  webhooksConfigured: boolean;
  notificationEmailsConfigured: boolean;
  isActive: boolean;
}

export interface FormSchema {
  formId: string;
  /** JSON Schema describing the accepted fields. */
  schema: Record<string, unknown>;
}

export interface IntegrationResult {
  formId: string;
  builderId: BuilderId;
  /** Generated code snippet ready to paste. */
  snippet: string;
  /** Builder-specific caveats to show the user. */
  caveats: readonly string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  line?: number;
}

export interface TestSubmissionResult {
  /** Whether the synthetic submission was accepted by the endpoint. */
  accepted: boolean;
  /** HTTP status code from the endpoint. */
  statusCode: number;
  /** The x-submitpulse-request-id for tracing. */
  requestId?: string;
}

export interface FormHealthResult {
  healthy: boolean;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  passed: boolean;
  detail?: string;
}
