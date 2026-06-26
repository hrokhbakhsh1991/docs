-- Workspace Integration Plugin System — generic connections + delivery jobs (RLS per tenant).

CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_type VARCHAR(50),
  provider VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'disabled',
  capabilities JSONB NOT NULL DEFAULT '[]',
  config JSONB NOT NULL DEFAULT '{}',
  credentials JSONB NOT NULL DEFAULT '{}',
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_integration_connections_tenant_provider_ws UNIQUE (tenant_id, provider, workspace_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_tenant_provider_status
  ON integration_connections (tenant_id, provider, status);

CREATE TABLE IF NOT EXISTS integration_delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  capability VARCHAR(50) NOT NULL,
  domain_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  last_error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ,
  CONSTRAINT uq_integration_delivery_jobs_idempotency
    UNIQUE (tenant_id, provider, capability, domain_event_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_delivery_jobs_claim
  ON integration_delivery_jobs (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_integration_delivery_jobs_tenant_status
  ON integration_delivery_jobs (tenant_id, status, created_at);

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_connections_tenant_isolation ON integration_connections;
CREATE POLICY integration_connections_tenant_isolation ON integration_connections
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE integration_delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_delivery_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_delivery_jobs_tenant_isolation ON integration_delivery_jobs;
CREATE POLICY integration_delivery_jobs_tenant_isolation ON integration_delivery_jobs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE integration_connections TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE integration_delivery_jobs TO app_tour;
