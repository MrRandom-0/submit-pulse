/**
 * Stage 5 — Schema validation.
 *
 * Parse the request body into a flat key/value map and run it against the
 * form's active field definitions.
 *
 * Accepted content types:
 *   - application/json
 *   - application/x-www-form-urlencoded
 *   - multipart/form-data (text fields only at this stage; files handled separately)
 *
 * IMPORTANT: Browser-side validation (HTML5 required, pattern, min/max) is
 * NEVER trusted. Every submission is re-validated server-side from scratch.
 */

import {
  validateSubmission,
  assertPayloadGuards,
  PayloadGuardError,
  type FieldDefinition,
  type FieldType,
} from "@submitpulse/validation/schema-validator";
import type { FormRow, FormFieldRow } from "../types.js";
import { Errors } from "../response.js";

const VALID_FIELD_TYPES = new Set<string>([
  "text", "email", "phone", "number", "url", "date",
  "textarea", "select", "multiselect", "checkbox", "hidden", "file",
]);

function toFieldType(raw: string): FieldType {
  if (VALID_FIELD_TYPES.has(raw)) return raw as FieldType;
  return "text"; // Safe fallback for unknown future types.
}

function toFieldDefinition(row: FormFieldRow): FieldDefinition {
  const c = row.constraints ?? {};
  return {
    name: row.name,
    type: toFieldType(row.type),
    required: row.required,
    constraints: {
      min: typeof c["min"] === "number" ? c["min"] : undefined,
      max: typeof c["max"] === "number" ? c["max"] : undefined,
      minLength: typeof c["minLength"] === "number" ? c["minLength"] : undefined,
      maxLength: typeof c["maxLength"] === "number" ? c["maxLength"] : undefined,
      pattern: typeof c["pattern"] === "string" ? c["pattern"] : undefined,
      allowedValues: Array.isArray(c["allowedValues"]) ? (c["allowedValues"] as string[]) : undefined,
      maxFileCount: typeof c["maxFileCount"] === "number" ? c["maxFileCount"] : undefined,
      maxFileSizeBytes: typeof c["maxFileSizeBytes"] === "number" ? c["maxFileSizeBytes"] : undefined,
      allowedMimeTypes: Array.isArray(c["allowedMimeTypes"]) ? (c["allowedMimeTypes"] as string[]) : undefined,
    },
  };
}

export type ParsedBody = {
  readonly payload: Record<string, unknown>;
  /** File entries from multipart — passed to the file-validation stage. */
  readonly files: Map<string, File[]>;
};

/**
 * Parse the raw body ArrayBuffer into a key/value payload and file map.
 */
export async function parseBody(
  body: ArrayBuffer,
  contentType: string,
  requestId: string,
  corsOrigin: string | null,
): Promise<ParsedBody | Response> {
  const ct = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (ct === "application/json") {
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return Errors.badRequest(requestId, "Invalid JSON body", corsOrigin);
    }
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      return Errors.badRequest(requestId, "JSON body must be an object", corsOrigin);
    }
    return { payload: json as Record<string, unknown>, files: new Map() };
  }

  if (ct === "application/x-www-form-urlencoded") {
    const text = new TextDecoder().decode(body);
    const params = new URLSearchParams(text);
    const payload: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      // Multiple values for the same key become an array.
      const existing = payload[key];
      if (existing === undefined) {
        payload[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        payload[key] = [existing, value];
      }
    }
    return { payload, files: new Map() };
  }

  if (ct === "multipart/form-data") {
    // Re-build a Request from the buffered body so we can use FormData parsing.
    const blob = new Blob([body], { type: contentType });
    const fakeRequest = new Request("https://dummy", { method: "POST", body: blob });
    let formData: FormData;
    try {
      formData = await fakeRequest.formData();
    } catch {
      return Errors.badRequest(requestId, "Could not parse multipart form data", corsOrigin);
    }

    const payload: Record<string, unknown> = {};
    const files = new Map<string, File[]>();

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        const existing = files.get(key) ?? [];
        existing.push(value);
        files.set(key, existing);
      } else {
        const existing = payload[key];
        if (existing === undefined) {
          payload[key] = value;
        } else if (Array.isArray(existing)) {
          (existing as string[]).push(value);
        } else {
          payload[key] = [existing, value];
        }
      }
    }
    return { payload, files };
  }

  return Errors.badRequest(
    requestId,
    `Unsupported Content-Type: ${ct}. Use application/json, application/x-www-form-urlencoded, or multipart/form-data`,
    corsOrigin,
  );
}

/**
 * Run schema validation against the parsed payload.
 */
export function runSchemaValidation(
  form: FormRow,
  payload: Record<string, unknown>,
  requestId: string,
  corsOrigin: string | null,
): { data: Record<string, unknown>; unexpectedData: Record<string, unknown> } | Response {
  try {
    assertPayloadGuards(payload);
  } catch (err) {
    if (err instanceof PayloadGuardError) {
      return Errors.badRequest(requestId, err.message, corsOrigin);
    }
    return Errors.badRequest(requestId, "Invalid payload structure", corsOrigin);
  }

  const fields: FieldDefinition[] = form.fields.map(toFieldDefinition);
  const result = validateSubmission(fields, payload);

  if (!result.ok) {
    return Errors.validationFailed(requestId, result.errors, corsOrigin);
  }

  return {
    data: result.data,
    unexpectedData: result.unexpectedData,
  };
}
