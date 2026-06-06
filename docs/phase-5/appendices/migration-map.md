# Migration map — Phase 5

> **SOURCE OF TRUTH:** data/schema migration scope for Phase 5 only  
> **Human research:** [`../../research/phase-5-data-architecture-research.md`](../../research/phase-5-data-architecture-research.md) §4.1 migration strategy  
> **MAP:** [`map-bridge.md`](map-bridge.md) · **DDL detail:** `docs/phase-5-canonical-schema.md` — **FAIL/BLOCKER** until exists (BLOCKER-P5-001)

## Phase 5 in scope

| Change                                     | Subphase | Action   | Notes                                              |
| ------------------------------------------ | -------- | -------- | -------------------------------------------------- |
| `canonical` → `canonical_data` (DB column) | 5.1      | P5-1-A03 | Prisma field `canonical` @map allowed per RULE-001 |
| `tenants.workspace_type`                   | 5.1      | P5-1-A04 | already in Prisma reference                        |
| `tours` JSONB envelope                     | 5.1      | P5-1-A02 | schemaVersion, roots, data                         |
| Projection columns on `tours`              | 5.3      | P5-3-A02 | derived from canonical                             |
| `outbox_events` table                      | 5.4      | P5-4-A01 | transactional emit                                 |
| `audit_events` table                       | 5.5      | P5-5-A01 | minimal who/tenant/action/entity                   |
| RLS on new tenant tables                   | 5.1      | P5-1-A06 | BLOCKER exact SQL in DEL-P5-001                    |

## Data migration (tenant content)

```yaml
data_migration_scope:
  allowed: empty or starter tenants only
  forbidden: Denali legacy trip_details cutover
  subphase: 5.1
  action: P5-1-A08
  rule: RULE-030
  phase_6: migrateCanonical full execution
```

## Schema version (canonical document)

```yaml
canonical_schema_version:
  field: canonical_data.schemaVersion inside JSONB
  hook: migrateCanonical(v, data) — design only Phase 5
  subphase: 5.2
  action: P5-2-A05
  dual_read: optional flag — default write newest only after Phase 5 gate
```

## Out of scope (Phase 6+)

| Item                            | Phase | FAIL if in Phase 5 PR |
| ------------------------------- | ----- | --------------------- |
| Denali `trip_details` migration | 6     | FORBIDDEN-014         |
| Finance outbox consumers        | 6     | FORBIDDEN-010         |
| Silo `tenant_routes`            | 7     | FORBIDDEN-012         |
| Enterprise read replica policy  | 7     | FORBIDDEN-029         |

## Infrastructure migration (MAP §5)

| Service     | Phase 5 requirement                                |
| ----------- | -------------------------------------------------- |
| Postgres 16 | migration up/down on real DB — MAP 5.1 exit        |
| Redis       | idempotency scaffold (Phase 4) — optional P5-X-A11 |
| Kafka/MinIO | **not required** — RULE-025, FORBIDDEN-004,011     |

**Cross-ref:** [`dependency-graph.md`](dependency-graph.md) · [`../subphases/5.1-canonical-schema.md`](../subphases/5.1-canonical-schema.md)
