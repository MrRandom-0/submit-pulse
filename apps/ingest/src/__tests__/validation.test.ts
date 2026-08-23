/**
 * Schema validation tests.
 *
 * Verifies that field-level errors are returned correctly and that the
 * payload guard rejects structural attacks.
 */

import { describe, it, expect } from "vitest";
import {
  validateSubmission,
  assertPayloadGuards,
  PayloadGuardError,
  MAX_FIELD_COUNT,
  MAX_NESTING_DEPTH,
  type FieldDefinition,
} from "@submitpulse/validation/schema-validator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_FIELD: FieldDefinition = {
  name: "email",
  type: "email",
  required: true,
};

const NAME_FIELD: FieldDefinition = {
  name: "name",
  type: "text",
  required: true,
  constraints: { minLength: 2, maxLength: 100 },
};

const OPTIONAL_PHONE: FieldDefinition = {
  name: "phone",
  type: "phone",
  required: false,
};

const SELECT_FIELD: FieldDefinition = {
  name: "role",
  type: "select",
  required: true,
  constraints: { allowedValues: ["admin", "user", "viewer"] },
};

// ---------------------------------------------------------------------------
// validateSubmission tests
// ---------------------------------------------------------------------------

describe("validateSubmission — valid payloads", () => {
  it("accepts a complete valid payload", () => {
    const result = validateSubmission([EMAIL_FIELD, NAME_FIELD], {
      email: "alice@example.com",
      name: "Alice",
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data["email"]).toBe("alice@example.com");
    expect(result.data["name"]).toBe("Alice");
  });

  it("accepts optional fields when absent", () => {
    const result = validateSubmission([EMAIL_FIELD, OPTIONAL_PHONE], {
      email: "bob@example.com",
    });
    expect(result.ok).toBe(true);
    expect(result.data["phone"]).toBeUndefined();
  });

  it("accepts select with allowed value", () => {
    const result = validateSubmission([SELECT_FIELD], { role: "admin" });
    expect(result.ok).toBe(true);
  });
});

describe("validateSubmission — validation errors", () => {
  it("reports missing required field", () => {
    const result = validateSubmission([EMAIL_FIELD, NAME_FIELD], {
      email: "x@x.com",
    });
    expect(result.ok).toBe(false);
    const nameError = result.errors.find((e) => e.field === "name");
    expect(nameError).toBeDefined();
  });

  it("reports invalid email", () => {
    const result = validateSubmission([EMAIL_FIELD], { email: "not-an-email" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.field).toBe("email");
  });

  it("reports minLength violation", () => {
    const result = validateSubmission([NAME_FIELD], {
      name: "X", // too short
    });
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.field === "name");
    expect(err).toBeDefined();
  });

  it("reports select value not in allowedValues", () => {
    const result = validateSubmission([SELECT_FIELD], { role: "superuser" });
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.field === "role");
    expect(err).toBeDefined();
  });

  it("can return multiple field errors in one call", () => {
    const result = validateSubmission([EMAIL_FIELD, NAME_FIELD], {
      email: "bad",
      name: "X",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe("validateSubmission — unexpected fields", () => {
  it("separates unexpected fields from validated data", () => {
    const result = validateSubmission([EMAIL_FIELD], {
      email: "alice@example.com",
      __proto__: "attack",
      unknownField: "value",
    });
    expect(result.ok).toBe(true);
    expect(Object.keys(result.unexpectedData)).toContain("unknownField");
    expect(Object.keys(result.data)).not.toContain("unknownField");
  });
});

// ---------------------------------------------------------------------------
// assertPayloadGuards tests
// ---------------------------------------------------------------------------

describe("assertPayloadGuards — field count limit", () => {
  it("accepts a payload at the limit", () => {
    const payload: Record<string, string> = {};
    for (let i = 0; i < MAX_FIELD_COUNT; i++) {
      payload[`field_${i}`] = "value";
    }
    expect(() => assertPayloadGuards(payload)).not.toThrow();
  });

  it("rejects a payload over the limit", () => {
    const payload: Record<string, string> = {};
    for (let i = 0; i <= MAX_FIELD_COUNT; i++) {
      payload[`field_${i}`] = "value";
    }
    expect(() => assertPayloadGuards(payload)).toThrow(PayloadGuardError);
  });
});

describe("assertPayloadGuards — nesting depth limit", () => {
  it("accepts payload at max depth", () => {
    // Build nesting at exactly MAX_NESTING_DEPTH levels.
    let obj: Record<string, unknown> = { leaf: "value" };
    for (let i = 0; i < MAX_NESTING_DEPTH - 1; i++) {
      obj = { nested: obj };
    }
    expect(() => assertPayloadGuards(obj)).not.toThrow();
  });

  it("rejects payload exceeding max depth", () => {
    // Build one more level of nesting than allowed.
    let obj: Record<string, unknown> = { leaf: "value" };
    for (let i = 0; i < MAX_NESTING_DEPTH + 1; i++) {
      obj = { nested: obj };
    }
    expect(() => assertPayloadGuards(obj)).toThrow(PayloadGuardError);
  });
});

describe("assertPayloadGuards — shape", () => {
  it("rejects arrays", () => {
    expect(() => assertPayloadGuards([1, 2, 3])).toThrow(PayloadGuardError);
  });

  it("rejects null", () => {
    expect(() => assertPayloadGuards(null)).toThrow(PayloadGuardError);
  });

  it("rejects primitives", () => {
    expect(() => assertPayloadGuards("string")).toThrow(PayloadGuardError);
  });

  it("accepts empty object", () => {
    expect(() => assertPayloadGuards({})).not.toThrow();
  });
});
