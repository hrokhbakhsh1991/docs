# Cross-cutting actions (P5-X-A\*)

> SOURCE OF TRUTH

## Cross-cutting — Current state preservation (source §1)

```yaml
P5-X-A01:
  description: Preserve single write path CanonicalTourService — no dual-write legacy tables
  inputs:
    - apps/api/src/canonical/canonical-tour.service.ts
    - source §1.2 Persisted tour state row
  outputs:
    - architecture invariant held
  validation:
    - no second SoT write introduced

P5-X-A02:
  description: Preserve LegacyCanonicalAdapter read-only integrity check only
  inputs:
    - LegacyCanonicalAdapter
    - validateCanonicalLegacySync
  outputs:
    - sync check remains non-authoritative
  validation:
    - legacy adapter does not receive writes

P5-X-A03:
  description: Preserve ScopedTourRepository CASL accessibleByTourWhere on all repository methods
  inputs:
    - apps/api/src/db/scoped-tour.repository.ts
  outputs:
    - CASL enforcement unchanged or strengthened
  validation:
    - FORBIDDEN_TOUR_CREATE_CROSS_TENANT on mismatch

P5-X-A04:
  description: Preserve withTenantTransaction set_config app.current_tenant_id before tenant queries
  inputs:
    - packages/tenant-kernel RLS_TENANT_SETTING
    - Phase 4 withTenantTransaction pattern
  outputs:
    - RLS session binding on all raw SQL paths
  validation:
    - no raw tenant query without session

P5-X-A05:
  description: Implement withCanonicalTransaction tenantId fn per Appendix A item 5
  inputs:
    - DEL-P5-001
    - source Appendix A item 5
  outputs:
    - withCanonicalTransaction API
  validation:
    - wraps prisma.$transaction and set_config tenant
```

## Cross-cutting — Compatibility matrix decisions (source §3)

```yaml
P5-X-A06:
  description: Reject platform-wide Event Sourcing implementation
  inputs:
    - source §3 Event Sourcing Reject
  outputs:
    - no event_store primary SoT
  validation:
    - no append-only stream as tour SoT

P5-X-A07:
  description: Reject separate CQRS data stores and async bus only projectors
  inputs:
    - source §3 CQRS Reject platform-wide
  outputs:
    - same Postgres database for command and query
  validation:
    - no second database introduced for Phase 5 reads

P5-X-A08:
  description: Defer CDC Debezium — do not implement in Phase 5
  inputs:
    - source §3 CDC Adopt Later
  outputs:
    - no debezium connector
  validation:
    - no Kafka Connect CDC in repo Phase 5

P5-X-A09:
  description: Defer Snapshot Strategies as ES snapshots — document JSONB row is snapshot
  inputs:
    - source §3 Snapshot Adopt Later
  outputs:
    - doc note canonical row is materialized state
  validation:
    - no separate snapshot table required unless DEL-P5-001 specifies

P5-X-A10:
  description: Defer Event Replay UI — operational hook only per P5-4-A12
  inputs:
    - source §3 Event Replay Adopt Later
  outputs:
    - replay hook doc only
  validation:
    - no replay UI shipped
```

## Cross-cutting — Idempotency (source §2.9 §3)

```yaml
P5-X-A11:
  description: Define API idempotency_key header scope per tenant per Appendix A item 6
  inputs:
    - DEL-P5-001 item 6
    - Redis Phase 4 scaffold
  outputs:
    - idempotency contract
  validation:
    - unique tenant_id idempotency_key constraint documented

P5-X-A12:
  description: Implement consumer dedupe table or equivalent for at-least-once relay
  inputs:
    - source §6 risk At-least-once duplicate handlers
  outputs:
    - dedupe mechanism
  validation:
    - duplicate delivery does not duplicate side effect
```

---
