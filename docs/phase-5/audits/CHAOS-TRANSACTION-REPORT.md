# Phase 5 — Chaos transaction integrity report

report_date: 2026-06-06
iterations: 5
partial_write_count: 0
verdict: **PASS**

Cross-link: [HARDENED-GATE-REPORT.md](./HARDENED-GATE-REPORT.md)

## Subprocess model

- Worker: `apps/api/test/chaos/atomic-crash-worker.ts`
- Parent: `apps/api/test/chaos/atomic-rollback-stress.spec.ts`
- Primary proof: throw `pre_commit` before TX commit
- SIGKILL: parent kill at ~400ms + worker self-kill after sleep (best-effort mid-TX)

## Iteration table

| #   | mode          | exit | signal  | orphan_tours | orphan_outbox | orphan_audit | partial | pass |
| --- | ------------- | ---- | ------- | ------------ | ------------- | ------------ | ------- | ---- |
| 1   | sigkill       | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |
| 2   | before_outbox | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |
| 3   | pre_commit    | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |
| 4   | before_outbox | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |
| 5   | pre_commit    | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |

## Atomicity verdict

All iterations rolled back atomically — **zero** partial writes (tour + audit + outbox all-or-nothing).
