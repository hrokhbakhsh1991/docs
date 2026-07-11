-- AP15 Faz 3 — keyset pagination support for listByTenantPage (tenantId, createdAt asc, id asc)
CREATE INDEX IF NOT EXISTS "idx_tours_tenant_created_id" ON "tours"("tenant_id", "created_at", "id");
