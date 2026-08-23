/**
 * Tests for webhook signature sign/verify round-trip.
 */

import { describe, it, expect } from "vitest";
import { signWebhook, verifyWebhook, REPLAY_WINDOW_SECONDS } from "@submitpulse/webhooks";
import { brand } from "@submitpulse/config";

const SECRET = "test-secret-abc123";
const BODY = JSON.stringify({ event: "submission.created", data: { id: "sub_x" } });
const DELIVERY_ID = "test-delivery-uuid-1234";
const NOW = 1_700_000_000;

describe("signWebhook + verifyWebhook round-trip", () => {
  it("produces a valid signature that verifies", () => {
    const headers = signWebhook(SECRET, BODY, DELIVERY_ID, NOW);
    const result = verifyWebhook(SECRET, BODY, headers, NOW);
    expect(result.valid).toBe(true);
  });

  it("includes all three brand headers", () => {
    const headers = signWebhook(SECRET, BODY, DELIVERY_ID, NOW);
    expect(headers).toHaveProperty(brand.wire.signatureHeader);
    expect(headers).toHaveProperty(brand.wire.timestampHeader);
    expect(headers).toHaveProperty(brand.wire.deliveryIdHeader);
  });

  it("signature header starts with sha256=", () => {
    const headers = signWebhook(SECRET, BODY, DELIVERY_ID, NOW);
    expect(headers[brand.wire.signatureHeader]).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("rejects a tampered body", () => {
    const headers = signWebhook(SECRET, BODY, DELIVERY_ID, NOW);
    const result = verifyWebhook(SECRET, BODY + " tampered", headers, NOW);
    expect(result.valid).toBe(false);
  });

  it("rejects a tampered secret", () => {
    const headers = signWebhook(SECRET, BODY, DELIVERY_ID, NOW);
    const result = verifyWebhook("wrong-secret", BODY, headers, NOW);
    expect(result.valid).toBe(false);
  });

  it("rejects a stale timestamp (replay protection)", () => {
    const headers = signWebhook(SECRET, BODY, DELIVERY_ID, NOW);
    const futureNow = NOW + REPLAY_WINDOW_SECONDS + 1;
    const result = verifyWebhook(SECRET, BODY, headers, futureNow);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/replay window/i);
  });

  it("accepts a timestamp within the replay window", () => {
    const headers = signWebhook(SECRET, BODY, DELIVERY_ID, NOW);
    const slightlyLater = NOW + REPLAY_WINDOW_SECONDS - 1;
    const result = verifyWebhook(SECRET, BODY, headers, slightlyLater);
    expect(result.valid).toBe(true);
  });

  it("rejects missing timestamp header", () => {
    const headers = signWebhook(SECRET, BODY, DELIVERY_ID, NOW);
    const { [brand.wire.timestampHeader]: _removed, ...rest } = headers;
    const result = verifyWebhook(SECRET, BODY, rest, NOW);
    expect(result.valid).toBe(false);
  });

  it("rejects missing signature header", () => {
    const headers = signWebhook(SECRET, BODY, DELIVERY_ID, NOW);
    const { [brand.wire.signatureHeader]: _removed, ...rest } = headers;
    const result = verifyWebhook(SECRET, BODY, rest, NOW);
    expect(result.valid).toBe(false);
  });

  it("rejects a non-sha256= prefixed signature", () => {
    const headers = signWebhook(SECRET, BODY, DELIVERY_ID, NOW);
    const corrupted = {
      ...headers,
      [brand.wire.signatureHeader]: "md5=badvalue",
    };
    const result = verifyWebhook(SECRET, BODY, corrupted, NOW);
    expect(result.valid).toBe(false);
  });
});
