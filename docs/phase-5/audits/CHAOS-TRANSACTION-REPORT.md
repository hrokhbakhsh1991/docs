# Phase 5 — Chaos transaction integrity report

report_date: 2026-06-05
iterations: 30
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
| 2   | before_outbox | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 3   | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 4   | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 5   | sigkill       | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |
| 6   | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 7   | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 8   | before_outbox | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 9   | sigkill       | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |
| 10  | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 11  | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 12  | before_outbox | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 13  | before_outbox | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 14  | outbox        | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 15  | outbox        | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 16  | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 17  | sigkill       | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |
| 18  | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 19  | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 20  | before_outbox | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 21  | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 22  | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 23  | sigkill       | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |
| 24  | before_outbox | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 25  | outbox        | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 26  | sigkill       | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |
| 27  | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 28  | pre_commit    | 1    | —       | 0            | 0             | 0            | 0       | PASS |
| 29  | sigkill       | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |
| 30  | sigkill       | null | SIGKILL | 0            | 0             | 0            | 0       | PASS |

## Atomicity verdict

All iterations rolled back atomically — **zero** partial writes (tour + audit + outbox all-or-nothing).
