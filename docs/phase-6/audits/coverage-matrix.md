# Phase 6 — Coverage matrix

> **SOURCE OF TRUTH:** subphase ↔ REQ ↔ DAG node

| Subphase | DAG  | Actions      | REQ rows        | Proven by (target)             | FORBIDDEN focus | DoD         |
| -------- | ---- | ------------ | --------------- | ------------------------------ | --------------- | ----------- |
| 6.0      | P6-0 | P6-0-A01–A05 | 001–003,020,025 | phase-5:gate + entry yaml      | P6-F-002        | 6.0         |
| 6.1      | P6-1 | P6-1-A01–A04 | 004–005,027     | phase-6.contract.spec scaffold | P6-F-003        | 6.1         |
| 6.2      | P6-2 | P6-2-A01–A06 | 006–009,008,021 | registry-parity.spec           | P6-F-002        | 6.2         |
| 6.3      | P6-3 | P6-3-A01–A03 | 010             | composites.contract.spec       | P6-F-003        | 6.3         |
| 6.4      | P6-4 | P6-4-A01–A04 | 011–012,028     | finance-outbox-consumer.spec   | P6-F-001        | 6.4         |
| 6.5      | P6-5 | P6-5-A01–A04 | 013–014,024,026 | denali-workspace-plugin.spec   | P6-F-004        | 6.5         |
| 6.6      | P6-6 | P6-6-A01–A03 | 015,023,029     | smoke + golden snapshots       | P6-F-004        | 6.6         |
| 6.7      | P6-7 | P6-7-A01–A03 | 016             | minio-photo.spec               | —               | 6.7         |
| 6.8      | P6-8 | P6-8-A01–A03 | 017             | migrate-canonical-denali.spec  | dual-write      | 6.8         |
| 6.9      | P6-9 | P6-9-A01–A05 | 018–019,022,030 | phase-6:gate + forensic        | P6-F-004        | 6.9         |
| cross    | —    | P6-X-A01–A04 | 021,029         | depcruise                      | P6-F-\*         | enforcement |

**Parallel after 6.2:** 6.3 ∥ 6.4 · **After 6.5:** 6.6 ∥ 6.7 · **Merge 6.9:** per BOOT-MANIFEST `merge_6_9_requires`
