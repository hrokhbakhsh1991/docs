# Tour update API (P1-6)

## HTTP

| Method  | Path         | Body                                            | Success                                           |
| ------- | ------------ | ----------------------------------------------- | ------------------------------------------------- |
| `PATCH` | `/tours/:id` | `{ rowVersion, data?, roots?, schemaVersion? }` | `200` + `{ id, tenantId, canonical, rowVersion }` |

`rowVersion` is required and must match the server row (`tours.row_version`). Stale versions return **409** `TOUR_VERSION_CONFLICT`.

## Persistence

| Field        | Column              | Role                                                   |
| ------------ | ------------------- | ------------------------------------------------------ |
| `rowVersion` | `tours.row_version` | Optimistic lock — incremented on successful CAS update |

Implementation: [`updateIfRowVersion`](../../../apps/api/src/storage/prisma-tour.repository.ts) / in-memory equivalent; orchestration in [`CanonicalTourService.updateTour`](../../../apps/api/src/canonical/canonical-tour.service.ts).

## Tenant trust boundary (DEC-029 / DM-CT-04)

`updateTour` binds tenant ALS via `runWithTenantContext(input.tenantId, …)` before calling the private `updateTourInActiveContext`. The inner path asserts `requireActiveTenantId() === input.tenantId` (same invariant as create) so validation gate keys, scoped repository predicates, and RLS GUC cannot diverge under scheduler interleave or direct internal calls.

## Audit trail (DEC-047 / AUDIT-GAP-02)

When `isForensicStorageDriver()` is true (`STORAGE_DRIVER=prisma` + `DATABASE_URL`), updates use `persistTourUpdateAtomically` — same `withCanonicalTransaction` boundary as create. An append-only `audit_events` row with `action = TOUR_UPDATED` commits in the same TX as the canonical row mutation. Memory driver updates remain **non-forensic** (no audit row).

Verification: `apps/api/test/5.5-audit-events.spec.ts` — `PATCH /tours/:id` after create.

## Rate limit

`PATCH /tours/:id` uses the **write** tenant rate-limit tier (DEC-015).

## Canonical patch merge (starter / default workspace)

Denali and Urban register `mergeCanonicalPatchData` in `workspace.manifest.json` (codegen → `workspace-tour-write-bindings.generated.ts`). Workspaces without a binding use the API **root-level shallow merge** fallback:

1. For each key in the PATCH `data` object, merge into the stored canonical `data` (object roots are shallow-merged; scalar roots are replaced).
2. `roots` on the merged body default to the stored tour roots unless the PATCH body supplies `roots` explicitly.

This preserves roots injected on create (e.g. `pricing` from P5-C commerce defaults) when operators PATCH only `basics` / `details` fragments. Replacing the entire `data` object on PATCH would drop sibling roots and fail pre-TX validation (`CANONICAL_ROOT_UNKNOWN`).

Verification: `apps/api/test/4-integration/schema-version-compat.spec.ts` — `SV-PATCH-OK`.

## Migration

Apply [`20260605170000_tours_row_version`](../../../apps/api/prisma/migrations/20260605170000_tours_row_version/migration.sql) before Postgres integration tests:

```bash
cd apps/api && DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5434/tour_db' pnpm exec prisma migrate deploy
```

## Verification

```bash
cd apps/api && NODE_ENV=test node --import tsx --test test/1-functional/concurrent-tour-logic.spec.ts
```
