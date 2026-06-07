# Migration head preflight at boot (DEC-097 / MD-GAP-12)

```yaml
status: implemented
phase: 5 evolution — P0 Phase 1
closes: MD-GAP-12, RB-GAP-04 (partial)
related: phase5-evolution-audit.md § Migration Danger recommendations
```

## Problem

After a failed `migrate deploy`, the DB schema may sit at migration **N-1** while the container image expects **N**. The API boots and serves traffic against a skewed schema — no fail-fast check ([MD-GAP-12](phase5-evolution-audit.md)).

## Decision

| Item     | Choice                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| When     | Production boot only (`isProductionAuthMode()` + `STORAGE_DRIVER=prisma`)                                         |
| Probe    | `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1` |
| Expected | `EXPECTED_PRISMA_MIGRATION_HEAD` constant in `src/db/migration-head-preflight.ts`                                 |
| Failure  | `throw new Error("PRODUCTION_MIGRATION_HEAD_MISMATCH:…")` — `main.ts` exits 1                                     |
| Guard    | `guard:migration-head-preflight` — constant must match latest `prisma/migrations/*` folder                        |

## Operator playbook

1. Run `pnpm exec prisma migrate deploy` with owner URL before rolling new image.
2. If deploy fails, fix SQL and redeploy — do **not** start API until `_prisma_migrations` head matches embedded constant.
3. After adding a migration, bump `EXPECTED_PRISMA_MIGRATION_HEAD` in the same PR.

## Head history (embedded constant)

| Migration folder                   | Landed in | Purpose                                                       |
| ---------------------------------- | --------- | ------------------------------------------------------------- |
| `20260605200000_outbox_last_error` | Phase 5   | Outbox `last_error` column                                    |
| `20260607100000_tenant_routes`     | Phase 7.7 | `tenant_routes` DDL for `TenantConnectionRouter` (REQ-P7-021) |

Current head: **`20260607100000_tenant_routes`** — must move in lockstep with `prisma/migrations/`.

## Verification

```bash
cd apps/api && pnpm run guard:migration-head-preflight
node --import tsx --test src/db/migration-head-preflight.spec.ts
```
