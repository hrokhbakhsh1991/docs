-- Phase 5.4-S4 — processed_domain_events (handler idempotency) + outbox unique guard

CREATE TABLE IF NOT EXISTS "processed_domain_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "domain_event_id" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_domain_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "processed_domain_events_tenant_id_domain_event_id_key"
    ON "processed_domain_events"("tenant_id", "domain_event_id");

CREATE INDEX IF NOT EXISTS "processed_domain_events_tenant_id_processed_at_idx"
    ON "processed_domain_events"("tenant_id", "processed_at");

ALTER TABLE "processed_domain_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "processed_domain_events" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS processed_domain_events_tenant_isolation ON "processed_domain_events";
CREATE POLICY processed_domain_events_tenant_isolation ON "processed_domain_events"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

CREATE UNIQUE INDEX IF NOT EXISTS "outbox_events_tenant_id_domain_event_id_key"
    ON "outbox_events"("tenant_id", "domain_event_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "processed_domain_events" TO app_tour;
