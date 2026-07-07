CREATE TABLE IF NOT EXISTS integration_delivery_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_type TEXT,
  integration_connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  selected_field_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  template_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_integration_delivery_intents_conn_event
    UNIQUE (integration_connection_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_delivery_intents_tenant_event
  ON integration_delivery_intents (tenant_id, event_type, enabled);

INSERT INTO integration_delivery_intents (
  tenant_id,
  workspace_type,
  integration_connection_id,
  event_type,
  selected_field_ids,
  template_id,
  enabled,
  created_at,
  updated_at
)
SELECT
  ep.tenant_id,
  ic.workspace_type,
  ep.integration_connection_id,
  ep.event_type,
  COALESCE(ep.selected_field_ids, '[]'::jsonb),
  ep.message_template,
  (ep.selected_field_ids IS NOT NULL),
  ep.created_at,
  ep.updated_at
FROM integration_event_policies ep
INNER JOIN integration_connections ic ON ic.id = ep.integration_connection_id
WHERE ep.selected_field_ids IS NOT NULL
   OR ep.message_template IS NOT NULL
ON CONFLICT (integration_connection_id, event_type) DO NOTHING;

ALTER TABLE integration_delivery_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_delivery_intents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_delivery_intents_tenant_isolation ON integration_delivery_intents;
CREATE POLICY integration_delivery_intents_tenant_isolation ON integration_delivery_intents
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE integration_delivery_intents TO app_tour;
