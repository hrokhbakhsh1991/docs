# Dependency graph

> SOURCE OF TRUTH

```yaml
dependency_graph:
  external_prerequisites:
    - id: DEP-P5-EXT-00
      requires: "Phase 0 Closed"
      evidence: workspace-sdk CanonicalDocument contract
    - id: DEP-P5-EXT-01
      requires: "Phase 1 Closed"
      evidence: platform-core PlatformWizardEngine validateCanonical
    - id: DEP-P5-EXT-02
      requires: "Phase 2 Closed"
      evidence: design-tokens ui-primitives theme-react — visual only no Phase 5 mutation
    - id: DEP-P5-EXT-03
      requires: "Phase 3 Closed"
      evidence: apps/api CanonicalTourService single write path; CASL createApiAbility
    - id: DEP-P5-EXT-04
      requires: "Phase 4 phase-4:gate exit 0"
      evidence: pnpm run phase-4:gate
    - id: DEP-P5-EXT-05
      requires: "phase_5_entry_requires ALL items PASS"
      source: phase-4-enforcement.md phase_5_entry_requires
      items:
        - docs/phase-4-tenant-kernel.md sections 8-16 complete
        - pnpm run phase-4:gate exit 0
        - Forensic Phase 4 archived docs/audits/phase-4-zero-debt-forensic-audit.mdoc
        - Postgres SoT tours NOT in-memory default production
        - RLS migration applied all tenant tables
        - Event bus hook points exist outbox table NOT required at Phase 4 exit
  phase_internal_edges:
    - from: P5-0
      to: P5-1
      type: hard
    - from: P5-1
      to: P5-2
      type: hard
    - from: P5-1
      to: P5-3
      type: hard
    - from: P5-1
      to: P5-4
      type: hard
    - from: P5-1
      to: P5-5
      type: hard
    - from: P5-2
      to: P5-4
      type: hard
      reason: validate-before-persist before transactional outbox write path
    - from: P5-3
      to: P5-6
      type: hard
    - from: P5-4
      to: P5-6
      type: hard
    - from: P5-5
      to: P5-6
      type: hard
    - from: P5-2
      to: P5-6
      type: hard
  packages_consumed:
    - "@app-tour/workspace-sdk"
    - "@app-tour/platform-core"
    - "@app-tour/tenant-kernel"
    - "@app-tour/platform-events"
    - "@app-tour/workspace-starter"
    - "@apps/api"
  packages_produced:
    - apps/api Phase 5 data layer (canonical_data, outbox, audit) — contract at apps/api/test/phase-5.contract.spec.ts
  infrastructure_consumed:
    - PostgreSQL 16
    - DATABASE_URL
    - infra/sql/001_tenant_rls.sql pattern
    - Prisma interactive transactions
    - Redis idempotency scaffold Phase 4 optional
```

---
