-- Phase 4 — shared schema + RLS (run against app_tour_dev after docker compose up)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain TEXT NOT NULL UNIQUE,
  workspace_type TEXT NOT NULL DEFAULT 'starter',
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  canonical JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tours_tenant_id ON tours (tenant_id, id);

ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tours;
CREATE POLICY tenant_isolation ON tours
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- App role for RLS tests (optional — create manually in dev)
-- CREATE ROLE app_tour_app LOGIN PASSWORD 'app_tour';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON tours TO app_tour_app;
