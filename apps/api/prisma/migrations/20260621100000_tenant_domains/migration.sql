CREATE TABLE IF NOT EXISTS tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  surface TEXT NOT NULL DEFAULT 'marketing',
  status TEXT NOT NULL DEFAULT 'pending',
  cname_target TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant_id ON tenant_domains (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_domains TO app_tour;
