# Owner Cardinality Audit Report

## Staging (1-A.2)

**Status:** BLOCKED — `DATABASE_URL_ADMIN` staging secret not provided (user skipped).

Do **not** treat staging/production as green from this file alone.

---

## Development verification (1-A.3)

**Timestamp:** 2026-08-20T10:04:53.985Z

**Connection:** local PostgreSQL 16 — `postgresql://postgres@127.0.0.1:5432/tour_db` (`DATABASE_URL_ADMIN`)

**Index apply gate (this database):** GREEN

| Check | Result |
| ----- | ------ |
| Multiple ACTIVE owners | **0** |
| Zero ACTIVE (provisioning) | **0** |
| Zero ACTIVE (invalid) | **0** |
| Soft owners | **0** |
| After `db:seed` | denali tenant has exactly **1** ACTIVE owner; other seeded tenants have **0** memberships (no violation) |

### Commands used

```bash
export DATABASE_URL='postgresql://app_cloud:app_cloud@127.0.0.1:5432/tour_db'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5432/tour_db'
pnpm --filter @apps/api run db:migrate:deploy
pnpm --filter @apps/api run db:seed
pnpm --filter @apps/api run audit:owner-cardinality
```

### Migration

`20260820160000_user_tenants_one_active_owner` applied successfully on fresh DB.

Index present:

`uq_user_tenants_one_active_owner` UNIQUE `(tenant_id) WHERE role = 'owner' AND status = 'ACTIVE'`
