# Phase 6 — Doc execution scorecard

```yaml
scorecard_date: "2026-06-04-v2"
target_doc_execution_system: 96
target_critical_spec_quality: 96
guard_check: p6_doc_hardening
excludes: repo_behavioral
```

## Dimension scores

| Dimension       | Score  | Evidence                                               |
| --------------- | ------ | ------------------------------------------------------ |
| AI readability  | **96** | T0 boot ≤14 · AI-READABILITY-REPORT                    |
| Determinism     | **97** | TG-P6-005 unified · BOOT detect                        |
| Traceability    | **96** | 30 REQ · per-action registry · LEGACY-PORT             |
| Execution depth | **96** | completion_proof all subphases · primary specs 6.2/4/6 |
| Enforcement     | **96** | RULE-P6-001..015 · subphase_dod                        |
| Smoke clarity   | **96** | SMOKE-SCENARIO-MAP SMK-P6-01..06                       |
| Guard rigor     | **96** | semantic + existence checks                            |
| Honesty         | **97** | TRUTH probe · doc vs gate yaml split                   |

**Doc execution system:** **96**  
**Critical spec quality:** **96**

> Repo behavioral excluded. `phase-6:guard` ≠ product closure.

## Machine verification

```bash
pnpm run phase-6:guard
node scripts/guards/lib/phase-6-doc-hardening.mjs
```

## Criteria (v2)

| #   | Criterion                        | Guard id                  |
| --- | -------------------------------- | ------------------------- |
| 1   | All PEK files                    | `p6_doc_hardening`        |
| 2   | completion_proof every subphase  | `p6_completion_proof_all` |
| 3   | No DAG 6.5 conflict              | `p6_dag_no_conflict`      |
| 4   | RULE-P6 present                  | `p6_rules_present`        |
| 5   | Port + smoke maps                | `p6_port_smoke_maps`      |
| 6   | Per-action registry rows         | `p6_action_registry`      |
| 7   | CONSISTENCY executable checklist | manual + guard            |
| 8   | Forensic PENDING until 6.9 repo  | `p6_doc_hardening`        |
