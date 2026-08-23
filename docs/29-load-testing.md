# 29 — Load Testing

> **NO RESULTS EXIST. None of the scripts below have ever been executed. Do not treat any threshold value in this document as a measured result — they are design targets only.**

---

## What exists

Five k6 scripts in `load-tests/`:

| Script | Purpose |
|---|---|
| `submission-sustained.js` | Baseline ingestion throughput: normal traffic at sustained rate |
| `submission-burst.js` | Spike profile: rapid ramp-up to peak |
| `abusive-ip.js` | Rate limit assertion: single IP flooding one form |
| `many-forms.js` | Traffic spread across many form IDs |
| `large-rejected.js` | 413 fast-rejection assertion: oversized payloads |

A `load-tests/README.md` documents how to run the scripts once k6 is installed.

---

## Running (once infrastructure exists)

```bash
# Prerequisites: k6 v0.51+, ingest worker running at BASE_URL
export BASE_URL=https://staging.submitpulse.com

k6 run load-tests/submission-sustained.js
k6 run load-tests/submission-burst.js
k6 run load-tests/abusive-ip.js
k6 run load-tests/many-forms.js
k6 run load-tests/large-rejected.js

# Or override BASE_URL inline:
k6 run -e BASE_URL=https://ingest.example.com load-tests/submission-sustained.js
```

---

## Threshold rationale

These thresholds encode design targets from the product specification. They are not observations.

| Script | Key threshold | Spec target |
|---|---|---|
| `submission-sustained.js` | `http_req_duration p(95) < 300 ms` | 300 ms p95 acknowledgement at sustained rate |
| `submission-burst.js` | `http_req_duration p(95) < 300 ms` | Same |
| `abusive-ip.js` | Rate of 429 responses ≥ 90% once limit is exhausted | Rate limiting must engage |
| `many-forms.js` | `http_req_duration p(95) < 300 ms` | Same |
| `large-rejected.js` | `http_req_duration p(95) < 100 ms for 413` | Fast rejection before body is fully read |

---

## Prerequisites for meaningful results

The load tests would produce misleading or useless numbers unless all of the following are true:

1. `pnpm install` has succeeded and workers are built.
2. Cloudflare Workers deployed to a real environment (not `wrangler dev` — cold-start behaviour differs).
3. Cloudflare D1 provisioned with `D1FormRepository` SQL queries implemented.
4. Upstash Redis provisioned and `UpstashRateLimiter` in use — `InMemoryRateLimiter` does not share state across isolates and will not produce correct rate-limit measurements.
5. The test form(s) exist in the D1 database.
6. k6 v0.51 or later installed on the test runner machine.

None of these conditions exist.

---

## Recording results

When load tests are run, update this document with:

- **Date and commit SHA** of the codebase under test.
- **Environment**: Cloudflare region, D1 tier, Upstash tier.
- **Test parameters**: VU count, duration, ramp-up shape.
- **Results**: p50, p95, p99 latency (ms); error rate (%); maximum sustained throughput (req/s).
- **Rate limiter behaviour**: 429 rate under abusive-ip scenario.

Until this update occurs, no performance claim may be made for this product.
