# CI workflow files (staged)

These are the real CI definitions for this repository. They live here rather
than in `.github/workflows/` because the GitHub App used to push this codebase
does not hold the `workflows` permission — GitHub rejects any tree containing
`.github/workflows/*` with `403 Resource not accessible by integration`.

## To activate CI

```bash
mkdir -p .github/workflows
cp docs/ci/ci.yml docs/ci/e2e.yml docs/ci/codeql.yml .github/workflows/
cp docs/ci/dependabot.yml .github/
git add .github && git commit -m "ci: activate workflows" && git push
```

A push from your own account (not the App) carries the `workflow` scope, so it
will be accepted.

## What each workflow does

| File | Purpose |
|---|---|
| `ci.yml` | format check, lint, typecheck, unit + integration tests, build, dependency audit, secret scan, migration validation |
| `e2e.yml` | Playwright end-to-end suite with browser caching and HTML report artifact |
| `codeql.yml` | CodeQL static analysis |
| `dependabot.yml` | dependency update schedule |

## Before you trust a green check

None of these workflows has ever run. They were written against the repository
layout but never executed, because the npm registry was firewalled for the
entire build. Expect the first run to fail and need iteration — treat the first
green build as the real milestone, not this file landing.

Branch protection is **not** configured by these files. A workflow definition
does not enforce anything on its own; enable required status checks on `main`
in repository settings.
