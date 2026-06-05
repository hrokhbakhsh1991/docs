-- P1-14 / P1-16 — tenant FKs on Phase 5 satellite tables + pending outbox partial index

ALTER TABLE "outbox_events"
  ADD CONSTRAINT "outbox_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "http_idempotency_records"
  ADD CONSTRAINT "http_idempotency_records_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "processed_domain_events"
  ADD CONSTRAINT "processed_domain_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "outbox_events_pending_created_at_idx"
  ON "outbox_events" ("created_at")
  WHERE "status" = 'pending';
