/**
 * Server-side schema validation engine.
 *
 * IMPORTANT: Browser-side validation (HTML5 required, pattern, min/max,
 * etc.) is NEVER trusted. Every submission is re-validated here from
 * scratch, treating the payload as potentially adversarial.
 *
 * Given a form's field definitions, this module builds a Zod validator and
 * runs it against the submitted payload, returning structured field-level
 * errors. Unexpected fields are isolated into `unexpectedData` rather than
 * silently merged or silently dropped.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Field type enum — matches fieldTypeEnum in the database schema
// ---------------------------------------------------------------------------

export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "url"
  | "date"
  | "textarea"
  | "select"
  | "multiselect"
  | "checkbox"
  | "hidden"
  | "file";

// ---------------------------------------------------------------------------
// Field definition
// ---------------------------------------------------------------------------

export interface FieldConstraints {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly minLength?: number | undefined;
  readonly maxLength?: number | undefined;
  readonly pattern?: string | undefined;
  readonly allowedValues?: readonly string[] | undefined;
  readonly maxFileCount?: number | undefined;
  readonly maxFileSizeBytes?: number | undefined;
  readonly allowedMimeTypes?: readonly string[] | undefined;
}

export interface FieldDefinition {
  readonly name: string;
  readonly type: FieldType;
  readonly required: boolean;
  readonly constraints?: FieldConstraints | undefined;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface FieldError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  /** Validated, coerced field values. Only fields present in the schema. */
  readonly data: Record<string, unknown>;
  /**
   * Fields present in the submission but not in the form schema.
   * Stored separately so drift detection has evidence and so unexpected
   * input never silently merges into `data`.
   */
  readonly unexpectedData: Record<string, unknown>;
  readonly errors: readonly FieldError[];
}

// ---------------------------------------------------------------------------
// Payload guards (attack surface reduction)
// ---------------------------------------------------------------------------

/** Maximum number of top-level fields accepted in a single submission. */
export const MAX_FIELD_COUNT = 200;

/**
 * Maximum nesting depth for JSON payloads.
 * Deeply-nested objects can cause stack overflows in naive recursive parsers.
 */
export const MAX_NESTING_DEPTH = 5;

/** Maximum total serialised size of the payload (bytes / UTF-16 code units). */
export const MAX_TOTAL_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Assert that the payload does not exceed structural attack limits.
 * Call BEFORE building the field-level validator.
 */
export function assertPayloadGuards(raw: unknown): void {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new PayloadGuardError("Payload must be a JSON object", "BAD_SHAPE");
  }

  const keys = Object.keys(raw as Record<string, unknown>);
  if (keys.length > MAX_FIELD_COUNT) {
    throw new PayloadGuardError(
      `Too many fields: ${keys.length} (max ${MAX_FIELD_COUNT})`,
      "TOO_MANY_FIELDS",
    );
  }

  const depth = measureDepth(raw, 0);
  if (depth > MAX_NESTING_DEPTH) {
    throw new PayloadGuardError(
      `Payload nesting depth ${depth} exceeds max ${MAX_NESTING_DEPTH}`,
      "TOO_DEEP",
    );
  }
}

function measureDepth(value: unknown, current: number): number {
  if (current > MAX_NESTING_DEPTH) return current; // short-circuit
  if (typeof value !== "object" || value === null) return current;
  if (Array.isArray(value)) {
    let max = current;
    for (const item of value) {
      max = Math.max(max, measureDepth(item, current + 1));
    }
    return max;
  }
  let max = current;
  for (const v of Object.values(value as Record<string, unknown>)) {
    max = Math.max(max, measureDepth(v, current + 1));
  }
  return max;
}

export class PayloadGuardError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "PayloadGuardError";
  }
}

// ---------------------------------------------------------------------------
// Per-field Zod schema builder
// ---------------------------------------------------------------------------

function buildFieldSchema(
  field: FieldDefinition,
): z.ZodTypeAny {
  const c = field.constraints ?? {};
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case "text":
    case "hidden":
    case "textarea": {
      let s = z.string();
      if (c.minLength !== undefined) s = s.min(c.minLength);
      if (c.maxLength !== undefined) s = s.max(c.maxLength);
      if (c.pattern !== undefined) {
        const re = new RegExp(c.pattern);
        s = s.regex(re, `Does not match required pattern`);
      }
      schema = s;
      break;
    }

    case "email": {
      let s = z.string().email("Invalid email address");
      if (c.maxLength !== undefined) s = s.max(c.maxLength);
      schema = s;
      break;
    }

    case "phone": {
      // E.164 or liberal phone: at least 7 digits, optional +, spaces, dashes.
      let s = z.string().regex(
        /^\+?[\d\s\-().]{7,20}$/,
        "Invalid phone number",
      );
      if (c.maxLength !== undefined) s = s.max(c.maxLength);
      schema = s;
      break;
    }

    case "number": {
      let s = z.coerce.number();
      if (c.min !== undefined) s = s.min(c.min);
      if (c.max !== undefined) s = s.max(c.max);
      schema = s;
      break;
    }

    case "url": {
      let s = z.string().url("Invalid URL");
      if (c.maxLength !== undefined) s = s.max(c.maxLength);
      schema = s;
      break;
    }

    case "date": {
      // Accept ISO 8601 date strings (YYYY-MM-DD or full ISO).
      schema = z
        .string()
        .regex(
          /^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/,
          "Invalid date format — use ISO 8601",
        );
      break;
    }

    case "select": {
      if (c.allowedValues !== undefined && c.allowedValues.length > 0) {
        const [first, ...rest] = c.allowedValues as [string, ...string[]];
        schema = z.enum([first, ...rest], {
          errorMap: () => ({ message: "Value is not in the allowed list" }),
        });
      } else {
        schema = z.string();
      }
      break;
    }

    case "multiselect": {
      if (c.allowedValues !== undefined && c.allowedValues.length > 0) {
        const [first, ...rest] = c.allowedValues as [string, ...string[]];
        const itemSchema = z.enum([first, ...rest], {
          errorMap: () => ({ message: "Value is not in the allowed list" }),
        });
        let arrSchema = z.array(itemSchema);
        if (c.min !== undefined) arrSchema = arrSchema.min(c.min);
        if (c.max !== undefined) arrSchema = arrSchema.max(c.max);
        schema = arrSchema;
      } else {
        schema = z.array(z.string());
      }
      break;
    }

    case "checkbox": {
      // Checkboxes arrive as "true"/"false"/"on" from HTML forms, or booleans from JSON.
      schema = z
        .union([z.boolean(), z.enum(["true", "false", "on", "off", "yes", "no", "1", "0"])])
        .transform((v) => {
          if (typeof v === "boolean") return v;
          return ["true", "on", "yes", "1"].includes(v);
        });
      break;
    }

    case "file": {
      // File fields: value is a reference handle (string) set by the pipeline
      // after binary upload processing, or an array for multiple files.
      // The actual bytes are handled by the file-validation module in the
      // ingest pipeline — this validator only checks the handle shape.
      let arrSchema = z.array(z.string().min(1));
      if (c.maxFileCount !== undefined) arrSchema = arrSchema.max(c.maxFileCount);
      schema = arrSchema.or(z.string().min(1).transform((v) => [v]));
      break;
    }

    default: {
      // Exhaustive — fieldTypeEnum must not grow without updating here.
      const _exhaustive: never = field.type;
      schema = z.unknown();
      void _exhaustive;
    }
  }

  // Wrap in optional/nullable based on required flag.
  if (!field.required) {
    // Allow missing or empty-string from HTML forms.
    return z
      .union([z.undefined(), z.null(), z.literal(""), schema])
      .optional()
      .transform((v) => {
        // Normalise empty / null / undefined to undefined for optional fields.
        if (v === undefined || v === null || v === "") return undefined;
        return v;
      });
  }

  return schema;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run schema validation against a raw submission payload.
 *
 * @param fields   Active field definitions for this form.
 * @param payload  Raw parsed body (from JSON or FormData normalisation).
 */
export function validateSubmission(
  fields: readonly FieldDefinition[],
  payload: Record<string, unknown>,
): ValidationResult {
  const knownNames = new Set(fields.map((f) => f.name));

  // Separate expected from unexpected fields.
  const expectedPayload: Record<string, unknown> = {};
  const unexpectedData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (knownNames.has(key)) {
      expectedPayload[key] = value;
    } else {
      unexpectedData[key] = value;
    }
  }

  // Build per-field errors.
  const errors: FieldError[] = [];
  const data: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = expectedPayload[field.name];
    const schema = buildFieldSchema(field);
    const result = schema.safeParse(raw);

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          field: field.name,
          code: issue.code.toUpperCase(),
          message: issue.message,
        });
      }
    } else {
      if (result.data !== undefined) {
        data[field.name] = result.data;
      }
    }
  }

  return {
    ok: errors.length === 0,
    data,
    unexpectedData,
    errors,
  };
}
