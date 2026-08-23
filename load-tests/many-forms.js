/**
 * many-forms.js
 *
 * Traffic spread across many distinct form IDs. Validates that per-form
 * rate limiting and form lookup perform correctly when the hot set is large.
 *
 * This exercises the form lookup / KV layer under fan-out conditions and
 * ensures the worker does not degrade when it cannot cache a single hot form.
 *
 * NOTE: NO RESULTS EXIST. This script has never been executed.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const successRate = new Rate("submission_success_rate");
const successDuration = new Trend("submission_success_duration_ms", true);

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";

/**
 * Comma-separated list of public form IDs to spread load across.
 * Supply via -e FORM_IDS=fm_aaa,fm_bbb,fm_ccc or set many IDs for a realistic test.
 * Defaults to a single test form when not provided.
 */
const FORM_IDS: string[] = (__ENV.FORM_IDS || "fm_testformAAAAAAAAAAAAAA")
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean);

export const options = {
  stages: [
    { duration: "30s", target: 30 },
    { duration: "3m",  target: 30 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    submission_success_duration_ms: ["p(95)<300"],
    submission_success_rate: ["rate>0.98"],
    http_req_failed: ["rate<0.02"],
  },
};

export default function () {
  // Round-robin across form IDs using the VU and iteration counters.
  const formId = FORM_IDS[(__VU * 100 + __ITER) % FORM_IDS.length];

  const payload = JSON.stringify({
    name: `User VU${__VU} ITER${__ITER}`,
    email: `vu${__VU}@loadtest.example.com`,
    message: "Many-forms load test submission.",
  });

  const params = {
    headers: { "Content-Type": "application/json" },
    timeout: "10s",
  };

  const res = http.post(`${BASE_URL}/f/${formId}`, payload, params);

  const ok = check(res, {
    "status is 202": (r) => r.status === 202,
  });

  successRate.add(ok);
  if (ok) successDuration.add(res.timings.duration);

  sleep(Math.random() * 0.3 + 0.05);
}
