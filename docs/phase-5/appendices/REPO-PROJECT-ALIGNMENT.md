# Phase 5 — Repo ↔ project alignment (enterprise multi-tenant)

```yaml
alignment_date: "2026-06-04"
project: "Interoperable workspace SaaS — pool Postgres, shared schema, RLS per tenant"
guard: scripts/guards/lib/phase-5-repo-alignment.mjs
truth_ledger: ../audits/IMPLEMENTATION-TRUTH.md
implementation_decisions: IMPLEMENTATION-DECISIONS.md
```

> **Purpose:** Single table for **doc claims vs `apps/api` + `packages/` reality**.  
> **Before coding 5.3–5.5:** read [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) (write path, TX, relay, env).

## Enterprise tenant stack (verified paths)

| Concern            | Project contract            | Repo (2026-06-04)                                          | Doc module                  | Align                |
| ------------------ | --------------------------- | ---------------------------------------------------------- | --------------------------- | -------------------- |
| Host → tenant      | Phase 4 tenant-kernel       | `apps/api/src/tenant-kernel/` + `@app-tour/tenant-kernel`  | phase-4-bridge              | **YES**              |
| RLS session        | `app.current_tenant_id`     | `withTenantRls`, `withCanonicalTransaction`                | phase-5-canonical-schema §7 | **YES**              |
| CASL on tours      | Phase 3                     | `ScopedTourRepository`, `accessibleByTourWhere`            | workspace-data-layer        | **YES**              |
| Workspace plugin   | `workspace_type` → registry | `resolve-workspace-type.ts`, `resolve-workspace-plugin.ts` | schema §4.1                 | **YES**              |
| DB column SoT      | `canonical_data` JSONB      | `tours.canonical_data` via migration 002                   | phase-5-canonical-schema    | **YES**              |
| Prisma field name  | RULE-001 alias OK           | `Tour.canonical` `@map("canonical_data")`                  | schema §1 note below        | **YES** (alias)      |
| Projections        | title, schema_version       | Columns exist; **not synced on write**                     | 5.3 SPEC_ONLY               | **YES (honest gap)** |
| Outbox table + RLS | Phase 5.4                   | DDL + Prisma model; **no write/relay**                     | 5.4 SPEC_ONLY               | **YES (honest gap)** |
| Audit table + RLS  | Phase 5.5                   | DDL + Prisma model; **no append API**                      | 5.5 SPEC_ONLY               | **YES (honest gap)** |
| In-process events  | Phase 4 until 5.4           | `publishTourCreatedEvent` in `canonical-tour.service.ts`   | phase-4-bridge, FAQ         | **YES (expected)**   |

## Storage driver (BLOCKER-P5-007 nuance)

| Environment                      | Default driver                       | Enterprise Postgres SoT?             |
| -------------------------------- | ------------------------------------ | ------------------------------------ |
| `NODE_ENV=production`            | **prisma** (requires `DATABASE_URL`) | **YES**                              |
| dev/test, `STORAGE_DRIVER` unset | **memory**                           | **NO** — set `STORAGE_DRIVER=prisma` |
| `STORAGE_DRIVER=prisma`          | prisma                               | **YES**                              |

**Factory:** `apps/api/src/storage/create-tour-storage.ts` — **not** hard-coded `InMemoryTourRepository` in boot path.

**Wiring (cold-start lazy boot):** `main.ts` stays thin for `/health`; tour storage resolves on first `/tours` via [`lazy-tours-service.ts`](../../../apps/api/src/boot/lazy-tours-service.ts):

```typescript
// lazy-tours-service.ts (actual — not eager in main.ts)
const canonicalStore = new TourStorageDbAdapter(createTourStorageRepository());
```

See [`cold-start-lazy-boot.md`](cold-start-lazy-boot.md).

**5.0 entry `postgres_sot`:** PASS when production uses prisma **or** when `DATABASE_URL` + `STORAGE_DRIVER=prisma` in dev/CI.

## Contradictions resolved (doc fixes 2026-06-04)

| Was                                             | Fix                                                           |
| ----------------------------------------------- | ------------------------------------------------------------- |
| BLOCKER-P5-007 cited `main.ts` InMemory default | Points to `create-tour-storage.ts`; production already prisma |
| P5-0-A04 cited `TOUR_STORAGE` env               | Renamed to `STORAGE_DRIVER` per code                          |
| `packages/<data-layer>` contract path           | `apps/api/test/phase-5.contract.spec.ts`                      |
| IMPLEMENTATION-MAP `VERIFIED` without layer     | `VERIFIED_SCAFFOLD` / `VERIFIED_BEHAVIORAL`                   |

## Intentional gaps (not contradictions)

| Item                  | Doc status                                   | Code status                  |
| --------------------- | -------------------------------------------- | ---------------------------- |
| 5.3 projection sync   | SPEC_ONLY                                    | columns only                 |
| 5.4 outbox TX + relay | SPEC_ONLY                                    | in-process publish still     |
| 5.5 audit append      | SPEC_ONLY                                    | no API                       |
| phase-4:gate at 5.0   | PASS — `reports/phase-5-entry-verified.yaml` | re-run on Node 24 before 5.6 |

## Prisma ↔ Postgres naming (RULE-001)

```yaml
database_column: canonical_data
prisma_client_field: canonical
application_type: Tour["canonical"] as CanonicalDocument
rule: "SoT semantics in JSONB — Prisma property name is an implementation alias"
```

**Cross-links:** [`../../phase-4/appendices/storage-driver-truth.md`](../../phase-4/appendices/storage-driver-truth.md) · [`IMPLEMENTATION-MAP.md`](IMPLEMENTATION-MAP.md) · [`platform-continuity-0-5.md`](platform-continuity-0-5.md)
