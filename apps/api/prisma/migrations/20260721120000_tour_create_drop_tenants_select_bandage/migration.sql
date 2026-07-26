-- Tour create must not rely on SELECT against `tenants` under app_cloud.
-- Hostile audit (20260720160000) keeps FORCE RLS on tenants with no app_cloud policies.
-- Live debug sessions may have added tenants_current_tenant_select; drop it so the
-- durable contract (unchecked TourUncheckedCreateInput.tenantId) is the only path.
-- @see docs/phase-20/p7/appendices/TOUR_CREATE_TENANTS_RLS_FK.md

DROP POLICY IF EXISTS tenants_current_tenant_select ON tenants;
