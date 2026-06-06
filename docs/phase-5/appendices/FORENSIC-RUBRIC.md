# Phase 5 — Forensic purity rubric (REQ-P5-028)

```yaml
rubric_version: "2026-06-04-v2"
minimum_total: 8.0
scale_per_dimension: "0.0–1.0"
dimensions: 10
```

> Use at subphase **5.6** only. Record scores in `reports/phase-5-forensic-audit-YYYY-MM-DD.md` and [`phase-5-zero-debt-forensic-audit.mdoc`](../../audits/phase-5-zero-debt-forensic-audit.mdoc).

| #   | Dimension               | 1.0 when                                                      |
| --- | ----------------------- | ------------------------------------------------------------- |
| 1   | Boot determinism        | Agent used only `BOOT-MANIFEST` + router; no deprecated entry |
| 2   | Subphase DAG            | 5.4 after 5.2 behavioral; 5.6 after 5.2–5.5 behavioral        |
| 3   | Schema SoT              | `canonical_data` + DEL-P5-001 match migrations                |
| 4   | Validate-before-persist | RULE-003 ordering proven by specs                             |
| 5   | Projections             | 5.3 sync spec green; no JSONB @> hot path                     |
| 6   | Outbox                  | Same-TX + relay SKIP LOCKED + idempotency specs green         |
| 7   | Audit                   | 5.5 tenant RLS on `audit_events`                              |
| 8   | Anti-hollow             | No closure from scaffold contract/guard alone                 |
| 9   | Cross-phase gates       | `phase-4:gate` + `phase-5:gate` exit 0                        |
| 10  | Doc truth               | IMPLEMENTATION-TRUTH matches repo tests                       |

```yaml
scoring:
  total: "sum(dimensions) — must be >= 8.0"
  fail_if_any_dimension_below: 0.5
  evidence_required: "file path or CI log per dimension"
```
