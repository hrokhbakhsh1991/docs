# Phase 6 — State machine

```yaml
phase_id: "6"
fail_token: FAIL
sole_dag_guard: TG-P6-005
```

## DAG

```text
6.0  Entry (phase-5:gate)
  ↓
6.1  Denali package shell
  ↓
6.2  Registry + rules port
  ↓
  ├── 6.3  Widgets + theme  ─┐
  └── 6.4  Finance slice     ─┤ parallel (both required before 6.5)
       ↓
6.5  api/web bootstrap
  ↓
  ├── 6.6  Smoke parity  ─┐
  └── 6.7  MinIO photos   ─┤ parallel
       ↓
6.8  migrateCanonical execution
  ↓
6.9  Gate + forensic
```

| Transition guard | Rule                                                         |
| ---------------- | ------------------------------------------------------------ |
| TG-P6-001        | 6.1 blocked until 6.0 `phase_5_gate` PASS in yaml            |
| TG-P6-002        | 6.2 blocked until 6.1 VERIFIED_SCAFFOLD                      |
| TG-P6-003        | 6.8 blocked until 6.5 VERIFIED_BEHAVIORAL                    |
| TG-P6-004        | 6.9 blocked until merge_6_9_requires all VERIFIED_BEHAVIORAL |
| **TG-P6-005**    | **6.5 blocked until 6.2 + 6.3 + 6.4 VERIFIED_BEHAVIORAL**    |
| TG-P6-006        | 6.3 and 6.4 start only after 6.2 VERIFIED_BEHAVIORAL         |

> **No conflicting rule:** 6.5 always requires **6.2, 6.3, and 6.4** — see [`phase-6-enforcement.md`](phase-6-enforcement.md) RULE-P6-011.
