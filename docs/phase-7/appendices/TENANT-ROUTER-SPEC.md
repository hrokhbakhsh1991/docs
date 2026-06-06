# Tenant router specification

```yaml
spec_version: "2026-06-04-v2"
decision: DEC-P7-004
implementation_home: packages/tenant-kernel
map_ref: docs/MIGRATION-MAP.md §7.2
```

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

## Resolver flow

```text
TenantConnectionRouter.resolveRoute(tenantId)
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
- Migration: `infra/sql/003_tenant_routes.sql` (target path)
