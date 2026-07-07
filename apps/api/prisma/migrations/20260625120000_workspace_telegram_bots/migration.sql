---
-- Create workspace_telegram_bots table for storing tenant-specific Telegram bot configs
-- Each tenant can have its own bot for each workspace type (denali, urban, starter)

CREATE TABLE IF NOT EXISTS workspace_telegram_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_type VARCHAR(50) NOT NULL,
  bot_token VARCHAR(500) NOT NULL,
  channel_id VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_tenant_workspace_telegram UNIQUE(tenant_id, workspace_type)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_workspace_telegram_bots_tenant 
  ON workspace_telegram_bots(tenant_id);

CREATE INDEX IF NOT EXISTS idx_workspace_telegram_bots_tenant_workspace 
  ON workspace_telegram_bots(tenant_id, workspace_type);

-- Enable row-level security
ALTER TABLE workspace_telegram_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_telegram_bots FORCE ROW LEVEL SECURITY;

-- Create tenant isolation policy
DROP POLICY IF EXISTS workspace_telegram_bots_tenant_isolation ON workspace_telegram_bots;
CREATE POLICY workspace_telegram_bots_tenant_isolation ON workspace_telegram_bots
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE workspace_telegram_bots TO app_tour;

---
