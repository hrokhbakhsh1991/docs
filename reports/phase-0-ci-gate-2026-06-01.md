# Phase 0 CI gate — 2026-06-01

- **Generated:** 2026-06-01T08:27:25.135Z (updated after smoke run)
- **Git SHA:** `f715a8d`
- **Node:** v22.22.0
- **JSON:** [phase-0-ci-gate-2026-06-01.json](phase-0-ci-gate-2026-06-01.json)

## Gates

| Gate | Required | Result | Duration |
|------|----------|--------|----------:|
| ci_integrity | yes | PASS | 75.8s |
| web_build | yes | PASS | 88.6s |
| structural_guards | no | PASS | 6.0s |
| api_structural_integrity | no | PASS | 1.4s |
| root_build_known_issue | no | FAIL (expected) | 11.6s |
| draft_engine_test | no | PASS | 2.0s |
| playwright_smoke_subset | yes | FAIL | 66.5s |

## Phase 0.3 exit

- **Blocking gates (ci + web build):** PASS
- **Smoke subset:** FAIL on this runner — `pnpm run qa:smoke:tour-wizard` → 6 failed, 1 passed (2026-06-01). Symptom: `workspace-tour-wizard` not found after `/tours/new` (factory/instantiate/draft hydration). Follow-up PR required before Phase 1.1.

## Known issues (baseline)

- **node_engine** (warn): wanted Node 24, observed v22.22.0
- **root_pnpm_build** (info): `@repo/shared-contracts` → `@repo/types/denali` moduleResolution
- **playwright_smoke_regression** (warn): tour wizard smoke suite partially red — track under Phase 0.3 follow-up

## Failure tails

### playwright_smoke_subset

Port 3000 `EADDRINUSE` on first run; subsequent runs start server but wizard shell test id missing. Use `PW_SMOKE_PORT=3010` (see `playwright.smoke.config.ts`) when port 3000 is busy.
