# Test matrix — Phase 5

> **Contract honesty:** Until subphase **5.4** is `VERIFIED_BEHAVIORAL`, [`apps/api/test/phase-5.contract.spec.ts`](../../../apps/api/test/phase-5.contract.spec.ts) is **SCAFFOLD** only (file/DDL existence) — **not** outbox relay proof. Authoritative: [`MIGRATION-MAP.md`](../../MIGRATION-MAP.md) Phase 5 gate checklist · [`test-inventory.md`](test-inventory.md).

> **SOURCE OF TRUTH:** test scenarios ↔ REQ ↔ subphase ↔ files  
> **Verification rows:** [`../audits/verification-matrix.md`](../audits/verification-matrix.md)

```yaml
test_matrix:
  - id: P5-T-ENTRY-01
    subphase: "5.0"
    layer: gate
    scenario: phase-4:gate exit 0
    command: pnpm run phase-4:gate
    req: REQ-P5-002
    files: [package.json]

  - id: P5-T-ENTRY-02
    subphase: "5.0"
    layer: api
    scenario: Postgres SoT — STORAGE_DRIVER factory (not direct InMemory in main)
    command: inspect apps/api/src/storage/create-tour-storage.ts
    req: REQ-P5-004
    files: [apps/api/src/storage/create-tour-storage.ts, apps/api/src/main.ts]

  - id: P5-T-RLS-01
    subphase: "5.0"
    layer: postgres
    scenario: tenant A cannot read tenant B tours
    command: apps/api/test/rls-isolation.integration.spec.ts
    req: REQ-P5-005
    files: [apps/api/test/rls-isolation.integration.spec.ts, infra/sql/001_tenant_rls.sql]

  - id: P5-T-SCHEMA-01
    subphase: "5.1"
    layer: postgres
    scenario: canonical_data JSONB migration up
    command: prisma migrate / sql migrate
    req: REQ-P5-007
    files: [apps/api/prisma/schema.prisma, docs/phase-5-canonical-schema.md]

  - id: P5-T-VALID-01
    subphase: "5.2"
    layer: api
    scenario: invalid canonical rejected before DB write
    command: pnpm --filter @apps/api test
    req: REQ-P5-009
    files: [apps/api/src/tours/canonical-validation.ts]

  - id: P5-T-VALID-02
    subphase: "5.2"
    layer: unit
    scenario: assertCanonical and validateCanonical before transaction
    command: unit ordering tests
    req: [REQ-P5-010, REQ-P5-011]
    files: [packages/workspace-sdk, packages/platform-core]

  - id: P5-T-PROJ-01
    subphase: "5.3"
    layer: postgres
    scenario: list query uses index not seq scan
    command: EXPLAIN + query test
    req: [REQ-P5-012, REQ-P5-014]
    files: [apps/api repository list path]

  - id: P5-T-PROJ-02
    subphase: "5.3"
    layer: integration
    scenario: rollback removes canonical and projections
    command: integration P5-3-A03
    req: REQ-P5-013
    files: [apps/api/src/canonical/canonical-tour.service.ts]

  - id: P5-T-OUTBOX-01
    subphase: "5.4"
    layer: integration
    scenario: tour + outbox same transaction
    command: integration P5-4-A03
    req: REQ-P5-016
    files: [apps/api/src/canonical/canonical-tour.service.ts]

  - id: P5-T-OUTBOX-02
    subphase: "5.4"
    layer: integration
    scenario: TourCreated API to handler via outbox
    command: integration P5-4-A11
    req: [REQ-P5-018, REQ-P5-035]
    files: [packages/platform-events, outbox relay]

  - id: P5-T-OUTBOX-03
    subphase: "5.4"
    layer: unit
    scenario: cross-tenant dispatch throws
    command: P5-4-A08
    req: REQ-P5-022
    files: [packages/platform-events/src/bus.ts]

  - id: P5-T-AUDIT-01
    subphase: "5.5"
    layer: postgres
    scenario: audit_events migration and write on tour create
    command: P5-5-A02 P5-5-A03
    req: REQ-P5-023
    files: [audit_events table]

  - id: P5-T-GATE-01
    subphase: "5.6"
    layer: contract
    scenario: phase-5.contract.spec.ts SCAFFOLD — DEL-P5-001 artifacts exist (NOT outbox relay)
    command: pnpm --filter @apps/api test phase-5.contract.spec.ts
    req: REQ-P5-024
    files: [apps/api/test/phase-5.contract.spec.ts]
    behavioral_outbox_proof: apps/api/test/outbox-transactional.spec.ts
    see: test-inventory.md

  - id: P5-T-GATE-02
    subphase: "5.6"
    layer: adversarial
    scenario: cross-tenant outbox projection drift O(N) list
    command: P5-6-A02
    req: REQ-P5-025
    files: [contract specs]

  - id: P5-T-GATE-03
    subphase: "5.6"
    layer: forensic
    scenario: Purity Score >= 8
    command: P5-6-A05
    req: REQ-P5-028
    files: [reports/phase-5-forensic-audit-*.md]

gate_placeholders:
  phase_5_gate: pnpm run phase-5:gate
  status: BLOCKER-P5-002
```

**Depends on:** [`test-matrix`](test-matrix.md) · [`../ci.md`](../ci.md)
