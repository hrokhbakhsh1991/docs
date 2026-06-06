# Cross-phase entry map — Phase 5 → 6.0

```yaml
source_gate: pnpm run phase-5:gate
target_subphase: subphases/6.0-entry-gate.md
yaml_ledger: ../../../reports/phase-6-entry-verified.yaml
```

| #   | Requirement                          | 5.x proof                    | 6.0 field                    |
| --- | ------------------------------------ | ---------------------------- | ---------------------------- |
| 1   | `phase-5:gate` exit 0                | reports/phase-5-gate-\*.json | `phase_5_gate`               |
| 2   | IMPLEMENTATION-TRUTH 5.2+ honest     | ledger                       | `phase_5_behavioral_minimum` |
| 3   | No Denali in platform-core           | phase-5 boundaries           | `no_denali_core_creep`       |
| 4   | `resolveWorkspacePlugin` starter OK  | API tests                    | `starter_plugin_verified`    |
| 5   | Outbox path (if 6.4 finance depends) | 5.4 status                   | `outbox_behavioral`          |
