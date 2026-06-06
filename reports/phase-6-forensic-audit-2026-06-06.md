# Phase 6 — Forensic audit (2026-06-06)

```yaml
gate: phase-6
date: 2026-06-06
verdict: PENDING_GATE
phase_6_guard: reports/phase-6-gate-2026-06-06.json
phase_6_full_gate: FAIL — apps/api test tier (phase-4-resilience-regression-gate artifact / noisy-neighbor perf)
```

## Gate evidence

| Command                              | Result   | Notes                                                                     |
| ------------------------------------ | -------- | ------------------------------------------------------------------------- |
| `pnpm run phase-6:guard`             | **PASS** | doc pack + anti-hollow                                                    |
| `pnpm run phase-6:gate`              | **FAIL** | `@apps/api` test: `noisy-neighbor-latency.spec.ts` ratio 2.42× > 1.3× SLO |
| `phase-4:resilience-regression-gate` | **FAIL** | `phase4-resilience-postgres-specs` step                                   |

**Blocker for REQ-P6-022:** cross-phase Phase 4/5 gate residual — not Denali plugin regression.

## Dimension scores (FORENSIC-RUBRIC)

| #   | Dimension         | Score | Evidence                                                 |
| --- | ----------------- | ----- | -------------------------------------------------------- |
| 1   | Boot determinism  | 1.0   | BOOT-MANIFEST + agent router                             |
| 2   | Subphase DAG      | 1.0   | 6.5 after 6.2–6.4; 6.8 after 6.5                         |
| 3   | Plugin boundary   | 1.0   | denali in `packages/workspaces/denali` only              |
| 4   | Registry port     | 1.0   | `registry-parity.spec.ts` 59 fields                      |
| 5   | Bootstrap         | 1.0   | `denali-workspace-plugin.spec.ts` + web lazy loader      |
| 6   | Finance           | 0.9   | `finance-outbox-consumer.spec.ts`; BLOCKER-P6-OUTBOX-5.4 |
| 7   | MinIO             | 0.7   | prefix tests PASS; round-trip skips without `MINIO_*`    |
| 8   | Anti-hollow       | 0.9   | not doc-guard-only; gate blocked upstream                |
| 9   | Cross-phase gates | 0.5   | `phase-6:gate` not exit 0                                |
| 10  | Doc truth         | 0.9   | IMPLEMENTATION-TRUTH ↔ test inventory aligned            |

**Total: 9.0 / 10.0** — dimension 9 below closure threshold for REQ-P6-022.

## REQ sample (5)

| REQ        | Spec                                             | Status                                |
| ---------- | ------------------------------------------------ | ------------------------------------- |
| REQ-P6-017 | `migrate-canonical-denali.spec.ts`               | PASS                                  |
| REQ-P6-018 | `phase-6.contract.spec.ts` behavioral            | PASS (28 denali tests)                |
| REQ-P6-011 | `finance-outbox-consumer.spec.ts`                | PASS                                  |
| REQ-P6-016 | `minio-photo.spec.ts`                            | PASS (2 skip without env)             |
| REQ-P6-015 | `smoke-golden.spec.ts` + `denali-wizard.spec.ts` | golden PASS; Playwright needs servers |

## Verdict

**PENDING_GATE** — Denali subphases 6.1–6.8 behavioral; full Phase 6 closure requires `phase-6:gate` exit 0 (unblock Phase 4 noisy-neighbor perf or waive per Architect).
