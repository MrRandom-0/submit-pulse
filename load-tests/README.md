# Load Tests (k6)

Performance and resilience tests for the Submit Pulse ingestion endpoint.

## Prerequisites

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) v0.51 or later.
- The ingest worker running and accessible at `BASE_URL`.

## Running

```bash
# Set the target URL (default: http://localhost:8787)
export BASE_URL=https://staging.submitpulse.com

# Sustained load — normal traffic baseline
k6 run load-tests/submission-sustained.js

# Burst / spike profile
k6 run load-tests/submission-burst.js

# Single abusive IP — rate limiting assertion
k6 run load-tests/abusive-ip.js

# Traffic spread across many form IDs
k6 run load-tests/many-forms.js

# Oversized payloads — 413 rejection assertion
k6 run load-tests/large-rejected.js
```

Pass `-e BASE_URL=<url>` to override the environment variable inline:

```bash
k6 run -e BASE_URL=https://ingest.example.com load-tests/submission-sustained.js
```

## Results

**NO RESULTS EXIST. None of these scripts have ever been executed.**

Threshold values (p95 < 300 ms for non-file acknowledgements, rate-limit
engagement after burst) encode the spec's performance targets. Actual measured
numbers will depend on infrastructure, geographic distance to the edge, and
worker cold-start behaviour. Do not interpret the threshold values as
benchmarks — they are targets, not observations.

## Threshold rationale

| Script | Key threshold | Spec target |
|---|---|---|
| `submission-sustained.js` | http_req_duration p(95) < 300 ms | 300 ms p95 acknowledgement |
| `submission-burst.js` | http_req_duration p(95) < 300 ms | Same |
| `abusive-ip.js` | rate of 429 responses ≥ 0.9 once limit exhausted | Rate limiting must engage |
| `many-forms.js` | http_req_duration p(95) < 300 ms | Same |
| `large-rejected.js` | http_req_duration p(95) < 100 ms for 413 | Fast rejection before body read |
