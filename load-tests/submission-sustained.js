/**
 * submission-sustained.js
 *
 * Sustained steady-load test against the ingestion endpoint.
 * Simulates normal production traffic: a constant number of VUs posting
 * clean, valid form submissions over a 5-minute window.
 *
 * Threshold: p95 acknowledgement time < 300 ms (spec target for non-file
 * submissions). The threshold applies only to HTTP 202 responses — error
 * responses are tracked separately.
 *
 * NOTE: NO RESULTS EXIST. This script has never been executed.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const successRate = new Rate("submission_success_rate");
const successDuration = new Trend("submission_success_duration_ms", true);

// ---------------------------------------------------------------------------
// Test configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";
const FORM_ID = __ENV.FORM_ID || "fm_testformAAAAAAAAAAAAAA";

export const options = {
  stages: [
    { duration: "30s", target: 20 },  // ramp up
    { duration: "4m",  target: 20 },  // steady state
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    // p95 of all successful submissions must be under 300 ms.
    submission_success_duration_ms: ["p(95)<300"],
    // At least 99 % of requests should succeed (202).
    submission_success_rate: ["rate>0.99"],
    // Overall HTTP failure rate (non-2xx) must stay low.
    http_req_failed: ["rate<0.01"],
  },
};

// ---------------------------------------------------------------------------
// Default function — runs once per VU iteration
// ---------------------------------------------------------------------------

export default function () {
  const payload = JSON.stringify({
    name: `Load Test User ${__VU}-${__ITER}`,
    email: `vu${__VU}.iter${__ITER}@loadtest.example.com`,
    message: "Automated load test submission — sustained profile.",
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      // Omit Origin so origin enforcement does not block test traffic.
      // In a real staging environment use a whitelisted origin instead.
    },
    timeout: "10s",
  };

  const res = http.post(`${BASE_URL}/f/${FORM_ID}`, payload, params);

  const ok = check(res, {
    "status is 202": (r) => r.status === 202,
    "body has ok:true": (r) => {
      try {
        return JSON.parse(r.body).ok === true;
      } catch {
        return false;
      }
    },
  });

  successRate.add(ok);
  if (ok) {
    successDuration.add(res.timings.duration);
  }

  // Light think time to avoid an open-loop hammering pattern.
  sleep(Math.random() * 0.5 + 0.1);
}
