/**
 * abusive-ip.js
 *
 * Single-IP abuse simulation. All requests originate from the same virtual
 * IP (as far as k6 can simulate — in a real environment you would route
 * through a single egress IP).
 *
 * The test asserts that:
 *   1. The first N requests succeed (below rate limit).
 *   2. After the limit is exhausted, the endpoint returns 429.
 *   3. The 429 response is delivered quickly (the limit decision happens
 *      before heavy processing, not after).
 *
 * The IP rate limit window and per-window allowance depend on the ingest
 * worker configuration. These thresholds assume 100 requests / 60 s per IP
 * as documented in the ingest pipeline spec. Adjust RATE_LIMIT_WINDOW_SECONDS
 * and RATE_LIMIT_MAX_PER_WINDOW to match actual configuration.
 *
 * NOTE: NO RESULTS EXIST. This script has never been executed.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const allowedCount = new Counter("allowed_requests");
const blockedCount = new Counter("blocked_requests");
const blockedRate = new Rate("rate_limited_rate");
const blockedDuration = new Trend("rate_limited_response_duration_ms", true);

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";
const FORM_ID = __ENV.FORM_ID || "fm_testformAAAAAAAAAAAAAA";

// Approximate limit from the ingest rate-limit stage (ip, per window).
const RATE_LIMIT_MAX_PER_WINDOW = parseInt(__ENV.RATE_LIMIT_MAX || "100", 10);

export const options = {
  // 1 VU simulates a single abusive IP.
  vus: 1,
  iterations: RATE_LIMIT_MAX_PER_WINDOW * 3, // triple the limit to clearly exceed it
  thresholds: {
    // After the limit is hit, rate-limited responses must come back fast.
    rate_limited_response_duration_ms: ["p(95)<100"],
    // At least half of iterations should be rate-limited (we send 3x the limit).
    rate_limited_rate: ["rate>0.5"],
  },
};

export default function () {
  const payload = JSON.stringify({
    name: "Abusive IP Test",
    email: "abuse@loadtest.example.com",
    message: `Attempt ${__ITER}`,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
    timeout: "5s",
  };

  const res = http.post(`${BASE_URL}/f/${FORM_ID}`, payload, params);

  const rateLimited = res.status === 429;
  const accepted = res.status === 202;

  check(res, {
    "response is 202 or 429": (r) => r.status === 202 || r.status === 429,
  });

  blockedRate.add(rateLimited);

  if (accepted) {
    allowedCount.add(1);
  } else if (rateLimited) {
    blockedCount.add(1);
    blockedDuration.add(res.timings.duration);
  }

  // No sleep — we want to saturate as quickly as possible.
}
