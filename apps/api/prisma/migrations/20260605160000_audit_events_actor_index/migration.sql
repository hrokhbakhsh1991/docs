-- AUDIT-GAP-06 / DEC-127 — actor-scoped audit queries per tenant.
CREATE INDEX "audit_events_tenant_id_actor_id_created_at_idx" ON "audit_events"("tenant_id", "actor_id", "created_at");
