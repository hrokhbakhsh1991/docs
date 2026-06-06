# CI integrity extension — phase-4 guard + evolution gate (DEC-119)

```yaml
status: implemented
phase: 5 evolution — Platform 5.6
closes: CI-BYP-11 (partial), CI-BYP-13
related: docs/phase-4/ci.md, phase5-evolution-phase4-gate.md DEC-117
```

## Problem

`scripts/ci-integrity-check.sh` stopped at **phase-3:gate** while the script name implied full trunk integrity (**CI-BYP-11**). GHA workflows run `phase-4:gate` / `phase-5:gate` separately (**CI-BYP-13** drift).

## Decision

| Item           | Choice                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extended chain | phase-0 → phase-3 (unchanged) + **`phase-4:guard`** + **`@apps/api phase-5:evolution-gate`**                                                             |
| Full perf gate | **`phase-5:gate`** remains in `pnpm run test:full` and `.github/workflows/phase-5-gate.yml` — not pre-commit                                             |
| Rationale      | `phase-3:gate` already runs `build && test`; `phase-4:gate` would triple-compile. Guards + evolution static pack close the naming gap without 15+ min CI |

### New `ci:integrity` tail

| Step      | Command                                              | Requires                                 |
| --------- | ---------------------------------------------------- | ---------------------------------------- |
| 4 guard   | `pnpm run phase-4:guard`                             | `DATABASE_URL` for RLS integration slice |
| Evolution | `pnpm --filter @apps/api run phase-5:evolution-gate` | static guards only                       |

### What is still explicit (not `ci:integrity`)

| Command                 | When                            |
| ----------------------- | ------------------------------- |
| `pnpm run phase-4:gate` | Phase 4 PR / resilience closure |
| `pnpm run phase-5:gate` | Phase 5 perf + `db:test-reset`  |
| `pnpm run test:full`    | Pre-merge full stack            |

## Verification

```bash
pnpm run ci:integrity
# expect: PASS (phases 0–3 + phase-4 guard + evolution)
```

Meta guard: `apps/api/scripts/guard-ci-integrity-extension.mjs` (wired in evolution gate).
