-- Phase 7.7 — tenant connection routing (DEC-P7-004)

CREATE TABLE "tenant_routes" (
    "tenant_id" UUID NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'pool',
    "database_url" TEXT,
    "schema_name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_routes_pkey" PRIMARY KEY ("tenant_id"),
    CONSTRAINT "tenant_routes_tier_check" CHECK ("tier" IN ('pool', 'silo')),
    CONSTRAINT "tenant_routes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
