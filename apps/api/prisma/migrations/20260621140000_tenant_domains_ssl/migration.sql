ALTER TABLE tenant_domains
  ADD COLUMN IF NOT EXISTS ssl_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ssl_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ssl_last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_observed_cname TEXT;

CREATE INDEX IF NOT EXISTS idx_tenant_domains_ssl_expires
  ON tenant_domains (ssl_expires_at)
  WHERE ssl_status = 'active';
