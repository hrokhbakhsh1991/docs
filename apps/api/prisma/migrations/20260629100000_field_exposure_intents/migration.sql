CREATE TABLE IF NOT EXISTS exposure_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_type TEXT,
  profile_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  surface TEXT NOT NULL,
  audience TEXT NOT NULL,
  trigger TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope_hash TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'inherit_profile',
  selected_field_ids JSONB,
  template_override_id TEXT,
  source TEXT NOT NULL DEFAULT 'native',
  created_by_user_id UUID,
  updated_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT exposure_intents_mode_valid
    CHECK (mode IN ('inherit_profile', 'override_fields', 'disabled')),
  CONSTRAINT uq_exposure_intents_context_scope
    UNIQUE (tenant_id, profile_id, surface, audience, trigger, scope_hash)
);

CREATE INDEX IF NOT EXISTS idx_exposure_intents_tenant_ws_profile
  ON exposure_intents (tenant_id, workspace_type, profile_id);

CREATE INDEX IF NOT EXISTS idx_exposure_intents_context
  ON exposure_intents (tenant_id, surface, audience, trigger);

ALTER TABLE exposure_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE exposure_intents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exposure_intents_tenant_isolation ON exposure_intents;
CREATE POLICY exposure_intents_tenant_isolation ON exposure_intents
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE exposure_intents TO app_tour;
