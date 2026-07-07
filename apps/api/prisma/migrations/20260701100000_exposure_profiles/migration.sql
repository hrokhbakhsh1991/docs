-- Phase 8b: persisted exposure profiles become the enterprise default source.
CREATE TABLE IF NOT EXISTS exposure_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_type TEXT,
  profile_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  surface TEXT NOT NULL,
  audience TEXT NOT NULL,
  trigger TEXT NOT NULL,
  default_field_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_template_id TEXT,
  source TEXT NOT NULL DEFAULT 'native',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT exposure_profiles_default_field_ids_array
    CHECK (jsonb_typeof(default_field_ids) = 'array'),
  CONSTRAINT uq_exposure_profiles_tenant_profile
    UNIQUE (tenant_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_exposure_profiles_context
  ON exposure_profiles (tenant_id, workspace_type, surface, audience, trigger);

ALTER TABLE exposure_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exposure_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exposure_profiles_tenant_isolation ON exposure_profiles;
CREATE POLICY exposure_profiles_tenant_isolation ON exposure_profiles
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE exposure_profiles TO app_tour;
