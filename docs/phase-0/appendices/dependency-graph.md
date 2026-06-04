# Appendix — Dependency graph (DAG)

> Canonical DAG: [`../phase-0-state-machine.md`](../phase-0-state-machine.md) (SUBPHASE DAG).

```yaml
dag_edges:
  - { from: "0.1", to: "0.2" }
  - { from: "0.2", to: "0.3" }
  - { from: "0.1", to: "0.4" }
  - { from: "0.2", to: "0.5" }
  - { from: "0.3", to: "0.5" }
  - { from: "0.4", to: "0.5" }
  - { from: "0.5", to: "0.6" }
  - { from: "0.6", to: "Phase 1.1" }
allowed_overlap:
  - parallel: ["0.4", "0.2"]
  - parallel: ["0.4", "0.3"]
forbidden_overlap:
  - action: "implement platform-core before 0.6 PASS"
  - action: "merge platform-core feature work before baseline:metrics PASS"
```
