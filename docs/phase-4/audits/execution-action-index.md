# Phase 4 — Execution action index

> **SOURCE OF TRUTH for action IDs.** Detail lives in linked subphase files.

```yaml
action_index:
  "4.0":
    module: subphases/4.0-gate-of-gates.md
    tracks: [R0, R1, R2, R3]
    enforcement: [P4-E-RF-40, P4-E-AUTH-01, P4-E-SCALE-01]
  "4.1":
    module: subphases/4.1-tenant-kernel.md
    steps: [4.1-S1, 4.1-S2, 4.1-S3, 4.1-S4, 4.1-S5, 4.1-S6, 4.1-S7, 4.1-S8, 4.1-S9, 4.1-S10, 4.1-S11]
    enforcement: [P4-E-HOST-01, P4-E-RLS-02]
  "4.2":
    module: subphases/4.2-postgres-rls.md
    steps: [4.2-S1, 4.2-S2, 4.2-S3, 4.2-S4, 4.2-S5, 4.2-S6, 4.2-S7, 4.2-S8, 4.2-S9]
    enforcement: [P4-E-RLS-01, P4-E-DATA-01, P4-E-SCALE-01]
  "4.3":
    module: subphases/4.3-provisioning.md
    steps: [4.3-S1, 4.3-S2, 4.3-S3]
    enforcement: [P4-E-TENANT-01]
  "4.4":
    module: subphases/4.4-tenant-theme.md
    steps: [4.4-S1, 4.4-S2, 4.4-S3, 4.4-S4]
    test_matrix: [TH-1]
  "4.5":
    module: subphases/4.5-platform-events.md
    steps: [4.5-S1, 4.5-S2, 4.5-S3, 4.5-S4]
    enforcement: [P4-E-EVT-01]
  "4.6":
    module: subphases/4.6-phase-gate.md
    steps: [4.6-S1, 4.6-S2, 4.6-S3, 4.6-S4]
    enforcement: [P4-E-GATE, P4-E-REG-03]

execution_rule: "Execute steps in subphase file order; do not skip step IDs"
validation_rule: "Each step completion MUST map to P4-E-* or exit_criteria_* PASS"
completion_proof_rule: "Subphase PASS only when completion_proof.prove_with ALL green — see appendices/subphase-completion-schema.md"

completion_proof_by_subphase:
  "4.0": { type: track, file: subphases/4.0-gate-of-gates.md }
  "4.1": { type: p4_e, enforcement: [P4-E-HOST-01, P4-E-RLS-02] }
  "4.2": { type: p4_e, enforcement: [P4-E-RLS-01, P4-E-DATA-01, P4-E-SCALE-01, P4-E-RLS-02] }
  "4.3": { type: p4_e, enforcement: [P4-E-TENANT-01] }
  "4.4": { type: test_matrix, ids: [TH-1], dod: DOD-7 }
  "4.5": { type: p4_e, enforcement: [P4-E-EVT-01] }
  "4.6": { type: p4_e, enforcement: [P4-E-GATE, P4-E-REG-03], requires: ["4.0","4.1","4.2","4.3","4.4","4.5"] }
```
