# Phase 4 → Phase 5 bridge

```yaml
agent_load_tier: T0_execution
prerequisite_gate: pnpm run phase-4:gate
entry_contract: docs/phase-4/phase-4-enforcement.md#phase_5_entry_requires_modular
entry_map: appendices/CROSS-PHASE-ENTRY-MAP.md
canonical_continuity: ../../appendices/PLATFORM-CONTINUITY-0-5.md
```

## Handoff checklist (5.0)

| Phase 4 delivers              | Phase 5 requires                                           |
| ----------------------------- | ---------------------------------------------------------- |
| `packages/tenant-kernel`      | Host + RLS constants for data layer                        |
| Postgres + RLS on `tours`     | Extend DDL: `canonical_data`, outbox, audit                |
| In-process events (4.5)       | **Replace publish path** with outbox (5.4) — FORBIDDEN-006 |
| `phase-4:gate` green          | `5.0` runs `pnpm run phase-4:gate` again                   |
| No `outbox_events` at P4 exit | **5.4 creates** outbox table                               |

## Repo paths (active tree)

| Concern             | Path                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| API tours           | `apps/api/src/tours/`, `apps/api/prisma/schema.prisma`                           |
| Storage factory     | `apps/api/src/storage/create-tour-storage.ts` (`STORAGE_DRIVER=memory\|prisma`)  |
| Storage adapters    | `apps/api/src/storage/prisma-tour.repository.ts`, `in-memory-tour.repository.ts` |
| Tenant kernel (API) | `apps/api/src/tenant-kernel/`, `packages/tenant-kernel`                          |
| Phase 4 RLS SQL     | `infra/sql/001_tenant_rls.sql`                                                   |
| Phase 5 schema spec | `docs/phase-5-canonical-schema.md` (**BLOCKER**)                                 |

## Forbidden regression

- Dev/CI Postgres without `STORAGE_DRIVER=prisma` (`BLOCKER-P5-007` partial — production already prisma)
- `publishDomainEvent` without outbox after 5.4 (`FORBIDDEN-006`)
- Skip plugin validate-before-persist (`RULE-005`)

**Phase 4 agent docs:** [`../phase-4/phase-4-enforcement.md`](../phase-4/phase-4-enforcement.md) `phase_5_entry_requires_modular` · [`../phase-4/appendices/workspace-interoperability-model.md`](../phase-4/appendices/workspace-interoperability-model.md) · [`../phase-4/appendices/legacy-structure-bridge.md`](../phase-4/appendices/legacy-structure-bridge.md)

**Phase 5 alignment (read at 5.0):** [`industry-alignment-2026.md`](industry-alignment-2026.md) · [`platform-continuity-0-5.md`](platform-continuity-0-5.md) · [`workspace-data-layer-model.md`](workspace-data-layer-model.md)
