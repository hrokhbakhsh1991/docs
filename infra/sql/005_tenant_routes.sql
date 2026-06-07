-- REFERENCE ONLY (DEC-124) — applied via Prisma migration *_tenant_routes
-- See apps/api/prisma/migrations/

CREATE TABLE tenant_routes (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'pool' CHECK (tier IN ('pool', 'silo')),
  database_url TEXT,
  schema_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
