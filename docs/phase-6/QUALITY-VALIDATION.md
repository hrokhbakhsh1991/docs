# Phase 6 — Quality validation (doc pack)

```yaml
validation_date: "2026-06-04"
doc_execution_system: 96
critical_spec_quality: 96
guard: pnpm run phase-6:guard
```

## PASS criteria (documentation only)

| Gate          | Command                                          | Expected        |
| ------------- | ------------------------------------------------ | --------------- |
| Doc hardening | `pnpm run phase-6:guard`                         | all `p6_*` PASS |
| Consistency   | review `audits/CONSISTENCY-REPORT.md`            | doc_graph PASS  |
| Anti-hollow   | `node scripts/guards/lib/anti-hollow-phase6.mjs` | exit 0          |
| REQ coverage  | `audits/coverage-matrix.md`                      | 6.0–6.9 rows    |
| Broken links  | env-runtime-matrix · adr-006 exist               | PASS            |

## NOT in scope (repo)

- `packages/workspaces/denali` product implementation
- Playwright green
- Full historical 0–5 recursive nest (`phase-5:gate` / `test:full`) — **not** required for doc-pack validation
- `phase-6:gate` behavioral Option B path (`build` + `test` + `phase-5:runtime-proof` + `phase-5:guard` + residual `phase-3:apps-cert:post-test` + `phase-3:apps-cert:floors` + `phase-6:guard`) — separate from this doc-only score; **PASS ≠** full `phase-3:apps-cert`

## Score claim

**Doc execution system ≥ 96** when all rows above PASS — independent of repo behavioral score.
