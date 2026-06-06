# Phase 7 — State machine

```yaml
phase_id: "7"
fail_token: FAIL
sole_dag_guard: TG-P7-005
```

## DAG

```text
7.0  Entry (phase-6:gate)
  ↓
7.1  Urban package shell
  ↓
7.2  Genericity proof (no platform-core diff)
  ↓
7.3  api/web bootstrap
  ↓
7.4  Urban E2E create → publish
  ↓
  ├── 7.5  Observability + runbook  ─┐
  └── 7.6  Rate limits (Redis)       ─┤ parallel (both required before 7.7)
       ↓
7.7  TenantConnectionRouter silo
  ↓
7.8  Adversarial + ci:integrity
  ↓
7.9  Platform DoD gate + forensic
```

| Transition guard | Rule                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| TG-P7-001        | 7.1 blocked until 7.0 `phase_6_gate` PASS in yaml                        |
| TG-P7-002        | 7.2 blocked until 7.1 VERIFIED_SCAFFOLD                                  |
| TG-P7-003        | 7.3 blocked until 7.2 VERIFIED_BEHAVIORAL (genericity baseline recorded) |
| TG-P7-004        | 7.4 blocked until 7.3 VERIFIED_BEHAVIORAL                                |
| **TG-P7-005**    | **7.7 blocked until 7.5 + 7.6 VERIFIED_BEHAVIORAL**                      |
| TG-P7-006        | 7.5 and 7.6 start only after 7.4 VERIFIED_BEHAVIORAL                     |
| TG-P7-007        | 7.9 blocked until merge_7_9_requires all VERIFIED_BEHAVIORAL             |

> **No conflicting rule:** 7.7 always requires **7.5 and 7.6** — ops maturity before silo routing. See [`phase-7-enforcement.md`](phase-7-enforcement.md) RULE-P7-009.
