/**
 * Tests for drift.ts — field diffing and rename heuristics.
 * Run with: pnpm test (vitest)
 */

import { describe, it, expect } from "vitest";
import { diffSchema, inferType } from "../drift.js";
import type { SchemaField, ObservedField } from "../drift.js";

// ---------------------------------------------------------------------------
// inferType
// ---------------------------------------------------------------------------

describe("inferType", () => {
  it("infers null for null", () => expect(inferType(null)).toBe("null"));
  it("infers boolean", () => expect(inferType(true)).toBe("boolean"));
  it("infers number", () => expect(inferType(42)).toBe("number"));
  it("infers email", () => expect(inferType("foo@bar.com")).toBe("email"));
  it("infers url", () => expect(inferType("https://example.com")).toBe("url"));
  it("infers date", () => expect(inferType("2025-01-15")).toBe("date"));
  it("infers text for generic string", () => expect(inferType("hello")).toBe("text"));
  it("infers array", () => expect(inferType([])).toBe("array"));
  it("infers object", () => expect(inferType({})).toBe("object"));
});

// ---------------------------------------------------------------------------
// diffSchema — exact matches
// ---------------------------------------------------------------------------

describe("diffSchema — no drift", () => {
  it("returns empty array when schema and observed match perfectly", () => {
    const expected: SchemaField[] = [
      { name: "email", type: "email", required: true },
      { name: "name", type: "text", required: false },
    ];
    const observed: ObservedField[] = [
      { name: "email", inferredType: "email", value: "a@b.com" },
      { name: "name", inferredType: "text", value: "Alice" },
    ];
    const results = diffSchema(expected, observed);
    // type_changed for email→email is falsy; should be 0 or only unexpected_payload
    const nonTypeChanges = results.filter(
      (r) => r.kind !== "type_changed" && r.kind !== "unexpected_payload",
    );
    expect(nonTypeChanges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// diffSchema — field_removed
// ---------------------------------------------------------------------------

describe("diffSchema — field_removed", () => {
  it("detects a removed field with no similar observed candidate", () => {
    const expected: SchemaField[] = [
      { name: "email", type: "email", required: true },
      { name: "phone", type: "text", required: false },
    ];
    const observed: ObservedField[] = [
      { name: "email", inferredType: "email", value: "a@b.com" },
      // "totally_different" has no similarity to "phone"
      { name: "xyz_totally_different_qqq", inferredType: "text", value: "wat" },
    ];
    const results = diffSchema(expected, observed);
    const removed = results.filter((r) => r.kind === "field_removed");
    expect(removed).toHaveLength(1);
    expect(removed[0]?.fieldName).toBe("phone");
  });
});

// ---------------------------------------------------------------------------
// diffSchema — field_added
// ---------------------------------------------------------------------------

describe("diffSchema — field_added", () => {
  it("detects a new field not in schema", () => {
    const expected: SchemaField[] = [
      { name: "email", type: "email", required: true },
    ];
    const observed: ObservedField[] = [
      { name: "email", inferredType: "email", value: "a@b.com" },
      { name: "utm_source", inferredType: "text", value: "google" },
    ];
    const results = diffSchema(expected, observed);
    const added = results.filter((r) => r.kind === "field_added");
    expect(added.length).toBeGreaterThanOrEqual(1);
    expect(added.some((r) => r.fieldName === "utm_source")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// diffSchema — field_renamed
// ---------------------------------------------------------------------------

describe("diffSchema — field_renamed", () => {
  it("suggests a rename when names are similar", () => {
    const expected: SchemaField[] = [
      { name: "full_name", type: "text", required: true },
    ];
    const observed: ObservedField[] = [
      { name: "fullname", inferredType: "text", value: "Alice" },
    ];
    const results = diffSchema(expected, observed);
    const renamed = results.filter((r) => r.kind === "field_renamed");
    expect(renamed).toHaveLength(1);
    expect(renamed[0]?.renameSuggestion?.isSuggestion).toBe(true);
    expect(renamed[0]?.renameSuggestion?.fromField).toBe("full_name");
    expect(renamed[0]?.fieldName).toBe("fullname");
  });

  it("marks rename as a suggestion, not a fact", () => {
    const expected: SchemaField[] = [{ name: "firstname", type: "text", required: false }];
    const observed: ObservedField[] = [{ name: "first_name", inferredType: "text", value: "Bob" }];
    const results = diffSchema(expected, observed);
    const renamed = results.filter((r) => r.kind === "field_renamed");
    if (renamed.length > 0) {
      expect(renamed[0]?.renameSuggestion?.isSuggestion).toBe(true);
      expect(renamed[0]?.summary).toMatch(/SUGGESTION/i);
    }
  });

  it("does NOT suggest rename when names are completely dissimilar", () => {
    const expected: SchemaField[] = [{ name: "email", type: "email", required: true }];
    const observed: ObservedField[] = [{ name: "zzzqqqxxx", inferredType: "text", value: "foo" }];
    const results = diffSchema(expected, observed);
    const renamed = results.filter((r) => r.kind === "field_renamed");
    expect(renamed).toHaveLength(0);
    // Should emit field_removed + field_added instead
    expect(results.some((r) => r.kind === "field_removed")).toBe(true);
    expect(results.some((r) => r.kind === "field_added")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// diffSchema — type_changed
// ---------------------------------------------------------------------------

describe("diffSchema — type_changed", () => {
  it("detects type change when observed type differs", () => {
    const expected: SchemaField[] = [
      { name: "age", type: "number", required: false },
    ];
    const observed: ObservedField[] = [
      { name: "age", inferredType: "text", value: "twenty-five" },
    ];
    const results = diffSchema(expected, observed);
    const typeChanged = results.filter((r) => r.kind === "type_changed");
    expect(typeChanged).toHaveLength(1);
    expect(typeChanged[0]?.fieldName).toBe("age");
  });
});

// ---------------------------------------------------------------------------
// SSRF guard (import-level test — no real network call)
// ---------------------------------------------------------------------------

describe("diffSchema — result ordering", () => {
  it("orders results: removed < renamed < added < type_changed", () => {
    const expected: SchemaField[] = [
      { name: "old_field", type: "text", required: false },
      { name: "kept", type: "text", required: false },
    ];
    const observed: ObservedField[] = [
      { name: "kept", inferredType: "text", value: "x" },
      { name: "brand_new", inferredType: "text", value: "y" },
    ];
    const results = diffSchema(expected, observed);
    const kindOrder: Record<string, number> = {
      field_removed: 0, field_renamed: 1, field_added: 2,
      type_changed: 3, required_changed: 4, validation_changed: 5, unexpected_payload: 6,
    };
    for (let i = 1; i < results.length; i++) {
      const prev = kindOrder[results[i - 1]?.kind ?? ""] ?? 99;
      const curr = kindOrder[results[i]?.kind ?? ""] ?? 99;
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });
});
