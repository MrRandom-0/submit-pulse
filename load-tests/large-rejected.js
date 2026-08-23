/**
 * large-rejected.js
 *
 * Oversized-payload test. Sends bodies that exceed the form's maxBodyBytes
 * limit and asserts:
 *   1. The response status is 413 (Payload Too Large).
 *   2. The 413 is returned quickly — the worker must short-circuit before
 *      reading the entire body, keeping latency low under attack.
 *
 * The request-size check is the first pipeline stage in the ingest worker
 * (apps/ingest/src/pipeline/request-size.ts), so the 413 should arrive in
 * well under 100 ms under normal conditions.
 *
 * NOTE: NO RESULTS EXIST. This script has never been executed.
 */

import http from "k6/http";
import { check } from "k6";
import { Rate, Trend } from "k6/metrics";

const rejectedRate = new Rate("rejected_rate");
const rejectionDuration = new Trend("rejection_duration_ms", true);

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";
const FORM_ID = __ENV.FORM_ID || "fm_testformAAAAAAAAAAAAAA";

// Default form max body is 1 MiB (1_048_576 bytes). Send 2 MiB to ensure rejection.
const PAYLOAD_SIZE_BYTES = parseInt(__ENV.PAYLOAD_SIZE || "2097152", 10);

/** Build a string of exactly `n` bytes (ASCII only). */
function buildPadding(n: number): string {
  // "x" repeated n times — each character is one byte in UTF-8.
  return "x".repeat(n);
}

export const options = {
  vus: 10,
  duration: "1m",
  thresholds: {
    // Every oversized request must be rejected with 413.
    rejected_rate: ["rate>0.99"],
    // Rejection must be fast (no body processing should occur).
    rejection_duration_ms: ["p(95)<100"],
    // No 5xx errors — the server should handle these gracefully.
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  // Build a payload slightly over the limit. We use a valid JSON structure
  // so that the only reason for rejection is size, not parse failure.
  const filler = buildPadding(PAYLOAD_SIZE_BYTES);
  const payload = JSON.stringify({ padding: filler });

  const params = {
    headers: { "Content-Type": "application/json" },
    // Long timeout so we can measure the actual response time, not a client timeout.
    timeout: "15s",
  };

  const res = http.post(`${BASE_URL}/f/${FORM_ID}`, payload, params);

  const is413 = check(res, {
    "status is 413": (r) => r.status === 413,
    "body has PAYLOAD_TOO_LARGE code": (r) => {
      try {
        return JSON.parse(r.body)?.error?.code === "PAYLOAD_TOO_LARGE";
      } catch {
        return false;
      }
    },
  });

  rejectedRate.add(is413);
  if (is413) {
    rejectionDuration.add(res.timings.duration);
  }
}
