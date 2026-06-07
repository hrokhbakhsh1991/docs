# Tenant router specification

```yaml
spec_version: "2026-06-07-v3"
decision: DEC-P7-004
implementation_home: packages/tenant-kernel
map_ref: docs/MIGRATION-MAP.md §7.2
schema_truth: apps/api/prisma/migrations/*_tenant_routes (DEC-124)
reference_sql: infra/sql/005_tenant_routes.sql
```

## Schema deployment (DEC-124)

Operational DDL lives in **Prisma migrations** (`pnpm run db:migrate:deploy`).  
[`infra/sql/005_tenant_routes.sql`](../../../infra/sql/005_tenant_routes.sql) is reference-only — do not execute in CI gates.

## Current stub (trunk today)

```typescript
// packages/tenant-kernel/src/route.ts
export type TenantTier = "pool" | "silo";

export interface TenantRoute {
  readonly tenantId: string;
  readonly tier: TenantTier;
  readonly databaseUrl: string;
}
```

Phase 7 **extends** this interface — does not replace it:

```typescript
// Target extension (7.7)
export interface TenantRoute {
  readonly tenantId: string;
  readonly tier: TenantTier;
  readonly databaseUrl: string;
  readonly schemaName?: string; // optional schema-per-tenant silo
  readonly useRls: boolean; // true for pool; optional for dedicated silo DB
}
```

## tenant_routes DDL (target)

```sql
CREATE TABLE tenant_routes (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  tier TEXT NOT NULL DEFAULT 'pool' CHECK (tier IN ('pool', 'silo')),
  database_url TEXT,  -- NULL = pool default DATABASE_URL
  schema_name TEXT,   -- maps to TenantRoute.schemaName
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Mapping:** DB `database_url` → `TenantRoute.databaseUrl` (camelCase in TypeScript).

## API lookup adapter (`apps/api/src/tenant/tenant-route-lookup.ts`)

Prisma lookup runs only when `DATABASE_URL` is set **and** `tenantId` matches persisted UUID shape
(`isPersistedTenantUuid` — rejects dev string ids like `tenant-a`). Non-UUID contexts skip the query and
fall through to pool default `{ tier: pool, useRls: true }`, keeping memory-storage HTTP specs green in CI
after `tenant_routes` migration lands.

Per-tenant cache + singleflight avoids N round-trips during rate-limit bursts.

## Resolver flow

```text
TenantConnectionRouter.resolveRoute(tenantId)
  → if tenantId not persisted UUID: pool default (no DB)
  → SELECT * FROM tenant_routes WHERE tenant_id = $1
  → if no row OR tier=pool:
       return { tenantId, tier: pool, databaseUrl: env.DATABASE_URL, useRls: true }
  → if tier=silo:
       return { tenantId, tier: silo, databaseUrl: row.database_url ?? env.DATABASE_URL,
                schemaName: row.schema_name, useRls: !row.database_url }
  → on connect: SET LOCAL search_path if schemaName set
  → on connect: SET LOCAL tenant_id for RLS when useRls true
```

## Error cases

| Case                                                     | Behavior                                    |
| -------------------------------------------------------- | ------------------------------------------- |
| silo row with null `database_url` and null `schema_name` | FAIL fast — misconfigured tenant            |
| invalid tier in DB                                       | migration CHECK prevents                    |
| connection failure to silo URL                           | log `tenantId`, `tenantTier=silo`, alert P1 |

## RLS backstop

Pool tier **always** `useRls: true`. Dedicated silo DB may set `useRls: false` if DB is tenant-exclusive.

## PgBouncer note

Transaction pooling compatible with pool tier; silo dedicated URLs may bypass pooler.

## Verification

- REQ-P7-021..023 — subphase 7.7
- Test file: `packages/tenant-kernel/test/tenant-connection-router.spec.ts`
- Migration: `apps/api/prisma/migrations/*_tenant_routes` · reference `infra/sql/005_tenant_routes.sql`
