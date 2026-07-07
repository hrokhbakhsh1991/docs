-- Integration control plane: enabled flag, secret_ref, event policies, secret store.

ALTER TABLE integration_connections
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE integration_connections
  ADD COLUMN IF NOT EXISTS secret_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_integration_connections_tenant_enabled
  ON integration_connections (tenant_id, enabled);

CREATE TABLE IF NOT EXISTS integration_event_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_integration_event_policies_conn_event
    UNIQUE (integration_connection_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_event_policies_tenant_event
  ON integration_event_policies (tenant_id, event_type, enabled);

CREATE TABLE IF NOT EXISTS integration_secrets (
  secret_ref TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_integration_secrets_tenant
  ON integration_secrets (tenant_id);

ALTER TABLE integration_event_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_event_policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_event_policies_tenant_isolation ON integration_event_policies;
CREATE POLICY integration_event_policies_tenant_isolation ON integration_event_policies
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE integration_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_secrets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_secrets_tenant_isolation ON integration_secrets;
CREATE POLICY integration_secrets_tenant_isolation ON integration_secrets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE integration_event_policies TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE integration_secrets TO app_tour;
