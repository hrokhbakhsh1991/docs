-- CQ-1C — Finance commercial quote versions (immutable chain + tenant RLS)

CREATE TABLE IF NOT EXISTS finance_commercial_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  gross_minor TEXT NOT NULL,
  payable_minor TEXT NOT NULL,
  currency VARCHAR(8) NOT NULL,
  source TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  supersedes_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_commercial_quotes_tenant_registration_version UNIQUE (tenant_id, registration_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_finance_commercial_quotes_tenant_registration
  ON finance_commercial_quotes (tenant_id, registration_id);

CREATE INDEX IF NOT EXISTS idx_finance_commercial_quotes_tenant_registration_status
  ON finance_commercial_quotes (tenant_id, registration_id, status);

ALTER TABLE finance_commercial_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_commercial_quotes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_commercial_quotes_tenant_isolation ON finance_commercial_quotes;
CREATE POLICY finance_commercial_quotes_tenant_isolation ON finance_commercial_quotes
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE finance_commercial_quotes TO app_tour;
