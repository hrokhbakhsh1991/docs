# Phase 7 — Precision execution kernel (PEK)

```yaml
phase_id: "7"
critical_spec_quality: 96
doc_execution_system: 96
guard: pnpm run phase-7:guard
```

## Entry

| Role            | Path                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Human hub       | [`phase-7-platform-dod.md`](../phase-7-platform-dod.md)                                                   |
| **SOLE router** | [`phase-7-agent-router.md`](phase-7-agent-router.md)                                                      |
| Research (T3)   | [`research/phase-7-workspace-hardening-research.md`](../research/phase-7-workspace-hardening-research.md) |

## Doc execution score

| Metric                | Target | Guard                                      |
| --------------------- | ------ | ------------------------------------------ |
| Doc execution system  | **96** | `phase-7:guard`                            |
| Critical spec quality | **96** | subphase `completion_proof` + Primary spec |

## Subphases

7.0 → 7.1 → 7.2 → 7.3 → 7.4 → {7.5 ∥ 7.6} → 7.7 → 7.8 → 7.9

See [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml).

## Repo honesty

Urban package **absent** today — [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md).
