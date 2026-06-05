# Phase 5 — Completion proof schema

```yaml
modes:
  checklist: "5.0 — phase_5_entry_verified.yaml"
  schema_gate: "5.1 — requires DEL-P5-001 / phase-5-canonical-schema.md"
  req: "5.2–5.5 — REQ-P5-* via behavioral tests + migrations"
  closure: "5.6 — phase-5:gate + behavioral proof + forensic"

repo_status_enum:
  - SPEC_ONLY
  - PARTIAL
  - VERIFIED_SCAFFOLD
  - VERIFIED_BEHAVIORAL
  - BLOCKED

rules:
  - "VERIFIED_SCAFFOLD satisfies 5.1 only — not 5.2–5.5"
  - "5.2–5.5 require VERIFIED_BEHAVIORAL per test-inventory.md"
  - "phase-5:guard PASS alone is VERIFIED_SCAFFOLD at most"
  - "IMPLEMENTATION-TRUTH must match subphase yaml repo_status"

required_fields:
  - subphase
  - type: checklist | schema_gate | req | closure
  - prove_with: [command | file | test]
  - repo_status: repo_status_enum
  - blocker_ids: []

sync:
  ledger: audits/IMPLEMENTATION-TRUTH.md
  on_change_update: [IMPLEMENTATION-MAP.md, CLOSURE-CHECKLIST.md section B, subphases/{id}.md]
```
