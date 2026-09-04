-- TKT-001 Phase K1 — ticket numbers, workspace settings, search indexes

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER;

WITH numbered AS (
  SELECT
    id,
    tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC, id ASC) AS rn
  FROM tickets
)
UPDATE tickets t
SET ticket_number = numbered.rn
FROM numbered
WHERE t.id = numbered.id
  AND t.tenant_id = numbered.tenant_id
  AND t.ticket_number IS NULL;

ALTER TABLE tickets ALTER COLUMN ticket_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tickets_tenant_number
  ON tickets (tenant_id, ticket_number);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_created
  ON tickets (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_number_counters (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  next_number INTEGER NOT NULL DEFAULT 1
);

INSERT INTO ticket_number_counters (tenant_id, next_number)
SELECT tenant_id, COALESCE(MAX(ticket_number), 0) + 1
FROM tickets
GROUP BY tenant_id
ON CONFLICT (tenant_id) DO UPDATE
SET next_number = GREATEST(
  ticket_number_counters.next_number,
  EXCLUDED.next_number
);

CREATE TABLE IF NOT EXISTS ticket_workspace_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  module_enabled_override BOOLEAN,
  allowed_priorities JSONB,
  max_attachment_size_bytes INTEGER,
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  sla_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  disabled_category_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id UUID
);

ALTER TABLE ticket_workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_workspace_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_workspace_settings_tenant_isolation ON ticket_workspace_settings;
CREATE POLICY ticket_workspace_settings_tenant_isolation ON ticket_workspace_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_number_counters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_number_counters_tenant_isolation ON ticket_number_counters;
CREATE POLICY ticket_number_counters_tenant_isolation ON ticket_number_counters
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_workspace_settings TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_number_counters TO app_tour;
