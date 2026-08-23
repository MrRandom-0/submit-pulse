/**
 * Oversized payload tests.
 *
 * Verifies that the size guard rejects bodies that exceed the configured
 * limit without buffering the full stream.
 */

import { describe, it, expect } from "vitest";
import { readBodyWithSizeGuard } from "../pipeline/request-size.js";

function makeRequest(body: string, contentType = "application/json", contentLength?: number): Request {
  const headers: HeadersInit = { "Content-Type": contentType };
  if (contentLength !== undefined) {
    headers["Content-Length"] = String(contentLength);
  }
  return new Request("https://dummy/", {
    method: "POST",
    headers,
    body,
  });
}

describe("readBodyWithSizeGuard", () => {
  it("accepts a body within the limit", async () => {
    const body = JSON.stringify({ name: "Alice" });
    const req = makeRequest(body);
    const result = await readBodyWithSizeGuard(req, 1024, "req-1");
    expect(result instanceof Response).toBe(false);
    if (result instanceof Response) throw new Error("unexpected Response");
    expect(result.body.byteLength).toBeGreaterThan(0);
  });

  it("rejects when Content-Length exceeds limit (fast path)", async () => {
    const body = JSON.stringify({ name: "Alice" });
    const req = makeRequest(body, "application/json", 99_999_999);
    const result = await readBodyWithSizeGuard(req, 1024, "req-1");
    expect(result instanceof Response).toBe(true);
    if (result instanceof Response) {
      expect(result.status).toBe(413);
    }
  });

  it("rejects when actual body exceeds limit (streaming path)", async () => {
    const bigBody = "x".repeat(10_000);
    const req = makeRequest(bigBody);
    const result = await readBodyWithSizeGuard(req, 1024, "req-1");
    expect(result instanceof Response).toBe(true);
    if (result instanceof Response) {
      expect(result.status).toBe(413);
    }
  });

  it("rejects when body exceeds absolute max even if limit is higher", async () => {
    // The absolute max is 26_214_400 bytes. We can't easily create a buffer
    // that large in tests, so we fake via Content-Length.
    const req = makeRequest("{}", "application/json", 26_214_401);
    const result = await readBodyWithSizeGuard(req, 999_999_999, "req-1");
    expect(result instanceof Response).toBe(true);
    if (result instanceof Response) {
      expect(result.status).toBe(413);
    }
  });

  it("response body has consistent error shape", async () => {
    const req = makeRequest("x".repeat(2048));
    const res = await readBodyWithSizeGuard(req, 1024, "req-1");
    expect(res instanceof Response).toBe(true);
    if (!(res instanceof Response)) throw new Error();
    const json = await res.json() as Record<string, unknown>;
    expect(json["ok"]).toBe(false);
    expect(typeof json["requestId"]).toBe("string");
    const err = json["error"] as Record<string, unknown>;
    expect(err["code"]).toBe("PAYLOAD_TOO_LARGE");
  });
});
