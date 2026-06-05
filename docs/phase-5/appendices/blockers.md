# Blockers

> SOURCE OF TRUTH: BLOCKER-P5-\*

```yaml
blockers:
  - id: BLOCKER-P5-001
    field: deliverable DEL-P5-001
    status: RESOLVED_2026_06_04
    artifact: docs/phase-5-canonical-schema.md

  - id: BLOCKER-P5-002
    field: closure_gate_command
    status: RESOLVED_2026_06_04
    artifact: "package.json phase-5:gate = build + test + phase-4:gate + phase-5:guard"

  - id: BLOCKER-P5-003
    field: phase-5 contract spec path
    status: RESOLVED_2026_06_04_SCAFFOLD_ONLY
    artifact: apps/api/test/phase-5.contract.spec.ts
    note: "No separate packages/<data-layer> package — contract lives in apps/api per REPO-PROJECT-ALIGNMENT"

  - id: BLOCKER-P5-004
    field: projection field paths
    status: RESOLVED_2026_06_04
    artifact: docs/phase-5-canonical-schema.md section 5 projection_derivation_map

  - id: BLOCKER-P5-005
    field: p5_* guard IDs
    status: RESOLVED_2026_06_04
    artifact: scripts/guards/phase-5-guard.mjs

  - id: BLOCKER-P5-006
    field: canonical_markdoc
    status: RESOLVED_2026_06_04
    artifact: docs/phase-5-canonical-schema.mdoc

  - id: BLOCKER-P5-007
    field: postgres_sot_in_dev_and_ci
    status: PARTIAL_2026_06_04
    repo_truth: apps/api/src/storage/create-tour-storage.ts
    rules:
      production: "NODE_ENV=production → STORAGE_DRIVER prisma (requires DATABASE_URL)"
      dev_ci: "When DATABASE_URL set for enterprise tests → must set STORAGE_DRIVER=prisma explicitly"
      main_wiring: "main.ts uses createTourStorageRepository() — not direct InMemoryTourRepository"
    impact: dev/CI must set STORAGE_DRIVER=prisma when DATABASE_URL set — see IMPLEMENTATION-DECISIONS DEC-010
    resolution: env-runtime-matrix + apps/api/.env.example + 5.0 yaml PASS; production already prisma
    requires_architect: false

  - id: BLOCKER-P5-008
    field: RLS policies for outbox_events audit_events
    status: RESOLVED_2026_06_04
    artifact: docs/phase-5-canonical-schema.md sections 2-3 + infra/sql/002_phase5_data_layer.sql

  - id: BLOCKER-P5-009
    field: withCanonicalTransaction API signature
    status: RESOLVED_2026_06_04
    artifact: docs/phase-5-canonical-schema.md section 7 + apps/api/src/db/with-canonical-transaction.ts

  - id: BLOCKER-P5-010
    field: outbox DLQ and retention policy
    missing: Source §6 mitigation mentions DLQ but no schema
    impact: Operational replay and relay failure mitigation incomplete
    resolution: Define in phase-5-canonical-schema.md or forensic waiver
    requires_architect: true

  - id: BLOCKER-P5-011
    field: non-starter workspace_type plugin resolution test
    missing: Only starter plugin exists until Phase 6
    impact: RULE-005 full multi-plugin resolution cannot integration-test until Denali exists
    resolution: Test with starter workspace_type only in Phase 5; document waiver in forensic until Phase 6
    requires_architect: true

  - id: BLOCKER-P5-012
    field: nested phase-5:gate chain
    status: RESOLVED_2026_06_04
    artifact: "package.json phase-5:gate = build && test && phase-4:gate && phase-5:guard"
```

---
