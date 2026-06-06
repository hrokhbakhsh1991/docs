# Phase 5 — Enforcement

> SOURCE OF TRUTH: RULE-_ FORBIDDEN-_ DoD

---

# Hard Rules

```yaml
RULE-001:
  statement: Primary tour SoT is one JSONB column per tour aggregate named canonical_data in schema docs and migrations alias period acceptable per source §4.1
  test: schema inspection tours table column canonical_data JSONB NOT NULL
  enforceable: migration test + prisma schema

RULE-002:
  statement: Persist full CanonicalDocument semantics schemaVersion roots data inside JSONB
  test: round-trip write read equals input after assertCanonicalDocument
  enforceable: integration test

RULE-003:
  statement: assertCanonicalDocument AND PlatformWizardEngine.validateCanonical MUST run before transaction commit
  test: spy or trace ordering before prisma.$transaction
  enforceable: unit test
  repo_evidence_5_2: docs/phase-5-canonical-schema.md section 4.1 · apps/api/test/validate-before-persist-ordering.spec.ts
  status_2026_06_04: VERIFIED at API persist boundary (5.4 TX ordering extends same rule)

RULE-004:
  statement: tours MUST NOT be stored without tenant_id FK context
  test: INSERT without tenant_id FAIL
  enforceable: DB constraint + integration test

RULE-005:
  statement: WorkspacePlugin resolved from tenant.workspace_type or registry at validation time in Phase 5 not starter hard-code only at closure
  test: tenant workspace_type non-starter path BLOCKER until second plugin exists — starter-only registry resolution still PASS if workspace_type starter
  enforceable: code review + API test MAP 5.2

RULE-006:
  statement: Dual-write to legacy-shaped tables FORBIDDEN
  test: grep write paths to legacy tour tables in apps/api — zero
  enforceable: depcruise or contract test

RULE-007:
  statement: Parallel trip_details SoT in generic API FORBIDDEN Phase 6 port inside plugin only
  test: no trip_details table write in apps/api canonical path
  enforceable: static analysis

RULE-008:
  statement: Projections MUST update in same transaction as canonical_data write
  test: transaction rollback removes both canonical and projections
  enforceable: integration test

RULE-009:
  statement: Projections are derived not second SoT
  test: rebuild script DEL-P5-009 restores projections from canonical_data only
  enforceable: script test

RULE-010:
  statement: List filter hot paths MUST NOT use JSONB @> operators per source §6 JSONB hot-query mitigation
  test: EXPLAIN + code ban grep @> in list repository
  enforceable: guard or adversarial test

RULE-011:
  statement: outbox_events row MUST include tenant_id on every row
  test: schema NOT NULL tenant_id + insert test
  enforceable: migration + test

RULE-012:
  statement: publishDomainEvent MUST NOT execute before transaction commit in production write path after 5.4
  test: instrumented write path ordering
  enforceable: integration test

RULE-013:
  statement: prisma.$transaction MUST include tour write and outbox insert atomically
  test: kill connection mid-transaction — neither committed
  enforceable: integration test

RULE-014:
  statement: Cross-tenant event dispatch FORBIDDEN — DOMAIN_EVENT_TENANT_REQUIRED
  test: publish with empty tenantId throws
  enforceable: platform-events unit test extended

RULE-015:
  statement: Relay MUST use FOR UPDATE SKIP LOCKED for concurrent workers
  test: two relay workers no duplicate processing of same row
  enforceable: integration test

RULE-016:
  statement: Handlers MUST be idempotent — domain_event_id unique per tenant
  test: duplicate insert ON CONFLICT no double handler effect
  enforceable: integration test

RULE-017:
  statement: In-process bus MUST NOT be sole publisher in production when OUTBOX_ENABLED true
  test: production path always writes outbox row when flag true
  enforceable: env-gated test

RULE-018:
  statement: Production MUST fail-closed if outbox write fails when OUTBOX_ENABLED true
  test: simulated outbox insert failure → writeTour error
  enforceable: integration test

RULE-019:
  statement: RLS MUST apply to all new tenant-scoped tables — set_config before queries
  test: cross-tenant SELECT returns zero rows P4-E-RLS pattern extended
  enforceable: rls-isolation integration spec

RULE-020:
  statement: Raw SQL without withTenantTransaction or equivalent FORBIDDEN on tenant tables
  test: code search raw query without set_config
  enforceable: lint or contract test

RULE-021:
  statement: CASL accessibleByTourWhere MUST remain on ScopedTourRepository all methods
  test: existing scoped-tour tests PASS
  enforceable: unit tests

RULE-022:
  statement: RLS is safety net not substitute for CASL per MAP §7.1
  test: both layers present in request path
  enforceable: architecture review

RULE-023:
  statement: Platform-wide Event Sourcing FORBIDDEN in Phase 5
  test: no event_store table as tour SoT
  enforceable: schema review

RULE-024:
  statement: Separate CQRS database FORBIDDEN in Phase 5
  test: single DATABASE_URL for writes and sync reads
  enforceable: config review

RULE-025:
  statement: Kafka NATS Rabbit NOT required infrastructure Phase 5
  test: no mandatory message broker in docker-compose for phase 5 gate
  enforceable: infra review

RULE-026:
  statement: Denali workspace plugin packages/workspaces/denali FORBIDDEN until Phase 6
  test: package does not exist or not wired in apps/api bootstrap
  enforceable: depcruise

RULE-027:
  statement: MinIO object storage FORBIDDEN until Phase 6
  test: no MinIO required in phase 5 tests
  enforceable: infra review

RULE-028:
  statement: TenantConnectionRouter silo implementation FORBIDDEN until Phase 7
  test: no tenant_routes cutover logic
  enforceable: code review

RULE-029:
  statement: Denali legacy cutover migrateCanonical execution FORBIDDEN Phase 5 — hook design only
  test: no migration script targeting legacy trip_details in Phase 5 PR
  enforceable: PR scope check

RULE-030:
  statement: Data migration limited to empty or starter tenants only Phase 5
  test: migration script documentation constraint
  enforceable: review

RULE-031:
  statement: phase-5.contract.spec.ts REQUIRED — no grep-only Phase 5 closure
  test: file exists and CI invokes it
  enforceable: MAP §12

RULE-032:
  statement: Every CanonicalService repository adapter documents Big-O before merge
  test: comment or adjacent doc file per adapter
  enforceable: phase-5 gate or review checklist

RULE-033:
  statement: List filter paths MUST be O(log N) or indexed — O(N) full scan blocks closure
  test: adversarial list guard P5-6-A02
  enforceable: contract spec

RULE-034:
  statement: Phase 5 entry requires phase-4:gate exit 0 and phase_5_entry_requires ALL items
  test: P5-0 actions PASS
  enforceable: entry gate

RULE-035:
  statement: TourCreated outbox test MAP §6 exit REQUIRED for Phase 5 closure
  test: P5-4-A11 PASS
  enforceable: integration test

RULE-036:
  statement: audit_events minimal table REQUIRED MAP 5.5
  test: P5-5 actions PASS
  enforceable: migration + test

RULE-037:
  statement: Finance hooks ledger events FORBIDDEN Phase 5
  test: no finance consumer module wired
  enforceable: scope review

RULE-038:
  statement: platform-core MUST NOT import tenant-kernel — unchanged from Phase 4 import law
  test: depcruise
  enforceable: guard:architecture

RULE-039:
  statement: workspace plugin MUST NOT publish events directly to finance — API orchestration only MAP §6.1
  test: no plugin import platform-events publish in workspaces packages
  enforceable: depcruise

RULE-040:
  statement: Jobs requiring tenant scope MUST include explicit tenant_id and RLS session per source §6 Tenant migration job risk
  test: job entry set_config before work
  enforceable: contract test when jobs added
```

---

---

# Forbidden Actions

```yaml
FORBIDDEN-001:
  action: Implement platform-wide Event Sourcing with event store as tour primary SoT
  drift_type: architecture_drift
  source: source §3 Reject · ADR-005 rejected alternatives

FORBIDDEN-002:
  action: Introduce separate CQRS read database or async-only projectors without sync projections in write transaction
  drift_type: architecture_drift
  source: source §3 CQRS Reject · §4.1 projection Sync

FORBIDDEN-003:
  action: Use CDC Debezium Kafka Connect as primary integration mechanism in Phase 5
  drift_type: architecture_drift
  source: source §3 CDC Adopt Later · §4.3 non-goals

FORBIDDEN-004:
  action: Require Kafka NATS Rabbit as mandatory Phase 5 infrastructure
  drift_type: dependency_drift
  source: source §4.3 explicit non-goals

FORBIDDEN-005:
  action: Call publishDomainEvent before database transaction commit on tour write path after subphase 5.4
  drift_type: spec_drift
  source: source §4.1 Write path · RULE-012

FORBIDDEN-006:
  action: Use in-process platform-events bus as only event publisher in production when OUTBOX_ENABLED true
  drift_type: spec_drift
  source: source §4.1 Delivery semantics · ADR-005 rejected Keep in-process bus only

FORBIDDEN-007:
  action: Dual-write canonical data to legacy trip_details or parallel SoT tables in apps/api
  drift_type: architecture_drift
  source: source §4.1 Forbidden · §1.2

> **Phase 6–7 scope:** [`appendices/phase-boundaries.md`](appendices/phase-boundaries.md) · [`FUTURE-PROOFING-REPORT.md`](FUTURE-PROOFING-REPORT.md) — Phase 5 PRs must not ship items in MUST NOT tables.

FORBIDDEN-008:
  action: Add DENALI constants or strip functions in apps/api generic layer
  drift_type: scope_creep
  source: MAP Phase 6 forbidden — boundary §5

FORBIDDEN-009:
  action: Create packages/workspaces/denali or wire Denali bootstrap in api/web
  drift_type: scope_creep
  source: source §5 Phase 6 MUST NOT before

FORBIDDEN-010:
  action: Implement finance hooks ledger events or finance outbox consumer
  drift_type: scope_creep
  source: source §5 boundary table · RULE-037

FORBIDDEN-011:
  action: Implement MinIO photo upload e2e
  drift_type: scope_creep
  source: source §4.3 · §5

FORBIDDEN-012:
  action: Implement TenantConnectionRouter pool silo cutover
  drift_type: scope_creep
  source: source §4.3 · §5 Phase 7

FORBIDDEN-013:
  action: Ship OpenTelemetry full stack as Phase 5 requirement
  drift_type: scope_creep
  source: source §4.3

FORBIDDEN-014:
  action: Execute Denali legacy migrateCanonical data cutover on trip_details
  drift_type: scope_creep
  source: source §4.1 migration Data migration · §5

FORBIDDEN-015:
  action: Build user-facing event replay UI or event-sourced rebuild of tours from log
  drift_type: scope_creep
  source: source §4.1 replay strategy

FORBIDDEN-016:
  action: Filter or sort list endpoints using JSONB @> on canonical data hot path
  drift_type: architecture_drift
  source: source §6 JSONB hot-query · RULE-010

FORBIDDEN-017:
  action: Mark Phase 5 complete using grep-only guards without phase-5.contract.spec.ts
  drift_type: spec_drift
  source: MAP §12 Contractual Gate

FORBIDDEN-018:
  action: Start Phase 5 implementation while phase-4:gate fails or phase_5_entry_requires open
  drift_type: dependency_drift
  source: phase-4-enforcement phase_5_entry_requires

FORBIDDEN-019:
  action: Run tenant-scoped migration job without explicit tenant_id and RLS session
  drift_type: security_drift
  source: source §6 Tenant migration job cross-wire

FORBIDDEN-020:
  action: Execute raw SQL on tenant tables without withTenantTransaction set_config
  drift_type: security_drift
  source: source §6 RLS bypass · RULE-020

FORBIDDEN-021:
  action: Remove or weaken ScopedTourRepository CASL checks in favor of RLS only
  drift_type: security_drift
  source: source §1.7 · MAP §7.1

FORBIDDEN-022:
  action: Publish cross-tenant domain events or outbox relay without tenant guard
  drift_type: security_drift
  source: MAP §6.2 · source §1.5

FORBIDDEN-023:
  action: Import tenant-kernel into platform-core
  drift_type: dependency_drift
  source: Phase 4 import law RULE-038

FORBIDDEN-024:
  action: Let workspace plugin publish directly to finance module
  drift_type: architecture_drift
  source: MAP §6.1 RULE-039

FORBIDDEN-025:
  action: Add full-scan O(N) list-after-write repository path without indexed projection
  drift_type: architecture_drift
  source: MAP §12 R3 Complexity Bound

FORBIDDEN-026:
  action: Label Phase 5 Closed from schema file presence without DB runtime proof on real Postgres
  drift_type: spec_drift
  source: MAP Phase 5 Hardening filter

FORBIDDEN-027:
  action: Implement payment-grade idempotency stores as Phase 5 requirement
  drift_type: scope_creep
  source: source §5 boundary Idempotency row Phase 6

FORBIDDEN-028:
  action: Implement second workspace urban E2E
  drift_type: scope_creep
  source: source §5 Phase 7

FORBIDDEN-029:
  action: Implement read replica statement_timeout enterprise policy as Phase 5 deliverable
  drift_type: scope_creep
  source: source §5 Phase 7 defer

FORBIDDEN-030:
  action: Redesign CanonicalDocument shape or PlatformWizardEngine contract in Phase 5
  drift_type: architecture_drift
  source: user constraint NO architecture redesign · source §4.2 Continuity
```

---

---

## Definition of Done

## Subphase DoD

```yaml
subphase_dod:
  "5.0":
    hard:
      - ALL P5-0-A* validation PASS
      - phase_5_entry_verified.yaml recorded
    soft: []
  "5.1":
    hard:
      - DEL-P5-001 exists OR Architect waiver documented
      - P5-1-A05 migration up PASS on real Postgres
      - tours.canonical_data JSONB NOT NULL
      - tenants.workspace_type exists
      - P5-1-A07 capacity carryover verified
    soft:
      - migration down PASS if required by DEL-P5-001
  "5.2":
    hard:
      - P5-2-A04 MAP 5.2 API test PASS
      - P5-2-A02 P5-2-A03 ordering tests PASS
      - plugin resolver not starter-only hard-code at code level
    soft: []
  "5.3":
    hard:
      - P5-3-A05 MAP 5.3 query test PASS
      - P5-3-A03 same transaction PASS
      - P5-3-A04 index used on list EXPLAIN
      - P5-3-A06 rebuild script PASS
    soft: []
  "5.4":
    hard:
      - P5-4-A11 MAP 5.4 and MAP §6 TourCreated outbox test PASS
      - P5-4-A03 atomic transaction PASS
      - P5-4-A06 relay SKIP LOCKED PASS
      - P5-4-A07 idempotency PASS
      - RULE-012 enforced
    soft:
      - P5-4-A10 OUTBOX_ENABLED flag if staged rollout chosen
  "5.5":
    hard:
      - P5-5-A02 audit_events migration PASS
      - P5-5-A03 minimal write path PASS
    soft: []
  "5.6":
    hard:
      - P5-6-A01 phase-5.contract.spec.ts exists and PASS
      - P5-6-A02 adversarial PASS
      - P5-6-A03 Big-O documented
      - P5-6-A05 forensic Purity >= 8
      - P5-6-A06 closure gate exit 0 when command defined
    soft:
      - P5-6-A07 doc truth audit when phase-5 human doc exists
```

## Phase DoD

```yaml
phase_dod:
  hard:
    - current_subphase == DONE
    - ALL subphase_dod 5.0 through 5.6 hard items PASS
    - MAP Phase 5 items 5.1 5.2 5.3 5.4 5.5 exit criteria met
    - MAP §6 exit TourCreated outbox test met
    - MAP §12 Phase 5 Gate Compliance Checklist three bullets met
    - ADR-005 chosen architecture implemented — document JSONB + sync projections + transactional outbox + minimal audit + idempotency
    - ADR-005 rejected alternatives not present — FORBIDDEN-001 through 006 absent
    - source §4.3 explicit non-goals not shipped — FORBIDDEN-004 through 013 absent
    - source §5 Phase 6 items not shipped — FORBIDDEN-008 through 011 014 absent
    - source §5 Phase 7 items not shipped — FORBIDDEN-012 028 029 absent
    - REQ-P5-001 through REQ-P5-040 PASS or BLOCKER waived by Architect with forensic note
  soft:
    - DEL-P5-010 operational replay hook documented
    - reports/phase-5-forensic-audit-YYYY-MM-DD.md published
```

## Global DoD

```yaml
global_dod:
  hard:
    - Phase 5 phase_dod hard ALL PASS
    - Phase 4 remains closed — pnpm run phase-4:gate exit 0 on demand
    - No regression to phase-3:gate or phase-2:gate when nested in phase-5:gate chain BLOCKER until defined
    - platform-core unchanged import law RULE-038
    - workspace-sdk CanonicalDocument contract unchanged RULE-002
  soft:
    - phase-5-canonical-schema.mdoc created when doc-gate requires Markdoc canonical
```

---
