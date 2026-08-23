/**
 * submission-burst.js
 *
 * Spike / burst load test — simulates a sudden surge in traffic (e.g. a form
 * linked from a high-traffic newsletter) followed by a return to baseline.
 *
 * Threshold: p95 acknowledgement must remain under 300 ms even at peak.
 * Rate-limited responses (429) are expected during the spike; they are
 * counted separately and do NOT count as failures for the duration threshold.
 *
 * NOTE: NO RESULTS EXIST. This script has never been executed.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const successRate = new Rate("submission_success_rate");
const successDuration = new Trend("submission_success_duration_ms", true);
const rateLimitedRate = new Rate("rate_limited_rate");

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";
const FORM_ID = __ENV.FORM_ID || "fm_testformAAAAAAAAAAAAAA";

export const options = {
  stages: [
    { duration: "30s", target: 10 },   // baseline warm-up
    { duration: "10s", target: 200 },  // sudden spike
    { duration: "1m",  target: 200 },  // sustained peak
    { duration: "10s", target: 10 },   // drop back
    { duration: "2m",  target: 10 },   // recovery observation
    { duration: "30s", target: 0 },    // ramp down
  ],
  thresholds: {
    // 202 responses must still be fast.
    submission_success_duration_ms: ["p(95)<300"],
    // Rate-limited responses are expected; don't let them dominate.
    rate_limited_rate: ["rate<0.5"],
    // Explicit HTTP failures (5xx) should be near-zero.
    http_req_failed: ["rate<0.02"],
  },
};

export default function () {
  const payload = JSON.stringify({
    name: `Burst User ${__VU}-${__ITER}`,
    email: `burst${__VU}@loadtest.example.com`,
    message: "Burst test submission.",
  });

  const params = {
    headers: { "Content-Type": "application/json" },
    timeout: "10s",
  };

  const res = http.post(`${BASE_URL}/f/${FORM_ID}`, payload, params);

  const ok = res.status === 202;
  const rateLimited = res.status === 429;

  check(res, {
    "status is 202 or 429": (r) => r.status === 202 || r.status === 429,
  });

  successRate.add(ok);
  rateLimitedRate.add(rateLimited);
  if (ok) {
    successDuration.add(res.timings.duration);
  }

  sleep(Math.random() * 0.2);
}
