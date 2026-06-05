# Phase 6 — Forensic purity rubric (REQ-P6-019)

```yaml
rubric_version: "2026-06-04-v1"
minimum_total: 8.0
scale_per_dimension: "0.0–1.0"
dimensions: 10
```

> Use at subphase **6.9** only. Record in `reports/phase-6-forensic-audit-YYYY-MM-DD.md` and [`phase-6-zero-debt-forensic-audit.mdoc`](../../audits/phase-6-zero-debt-forensic-audit.mdoc).

| #   | Dimension         | 1.0 when                                   |
| --- | ----------------- | ------------------------------------------ |
| 1   | Boot determinism  | BOOT-MANIFEST + router only                |
| 2   | Subphase DAG      | 6.5 after 6.2+6.3+6.4; 6.9 after merge set |
| 3   | Plugin boundary   | No Denali in platform-core                 |
| 4   | Registry port     | 6.2 parity specs green                     |
| 5   | Bootstrap         | denali resolves api+web                    |
| 6   | Finance           | plugin consumer + tenant guard             |
| 7   | MinIO             | tenant-prefixed keys e2e                   |
| 8   | Anti-hollow       | No closure from doc guard alone            |
| 9   | Cross-phase gates | phase-5:gate + phase-6:gate exit 0         |
| 10  | Doc truth         | TRUTH ↔ tests 1:1                          |

```yaml
scoring:
  total: "sum(dimensions) >= 8.0"
  fail_if_any_dimension_below: 0.5
```
