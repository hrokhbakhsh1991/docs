-- Phase 5 — canonical_data rename, projections, outbox_events, audit_events + RLS
-- Prerequisite: infra/sql/001_tenant_rls.sql

-- 1. tours — rename SoT column when legacy name exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tours' AND column_name = 'canonical'
  ) THEN
    ALTER TABLE tours RENAME COLUMN canonical TO canonical_data;
  END IF;
END $$;

ALTER TABLE tours ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS schema_version INT NOT NULL DEFAULT 1;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS row_version INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_tours_tenant_title ON tours (tenant_id, title);
CREATE INDEX IF NOT EXISTS idx_tours_tenant_schema_version ON tours (tenant_id, schema_version);

-- 2. outbox_events
CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  domain_event_id TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (tenant_id, domain_event_id)
);

CREATE INDEX IF NOT EXISTS idx_outbox_tenant_status_created
  ON outbox_events (tenant_id, status, created_at);

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_tenant_isolation ON outbox_events;
CREATE POLICY outbox_tenant_isolation ON outbox_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- 3. audit_events
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_events (tenant_id, created_at);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_tenant_isolation ON audit_events;
CREATE POLICY audit_tenant_isolation ON audit_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
