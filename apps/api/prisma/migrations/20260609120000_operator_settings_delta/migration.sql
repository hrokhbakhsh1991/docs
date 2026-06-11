-- REFERENCE ONLY (DEC-124) — see apps/api/prisma/migrations/20260609120000_operator_settings_delta

-- Phase 9.6 operator settings delta (DEC-P9-010)

CREATE TABLE IF NOT EXISTS tenant_config (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_version INT NOT NULL CHECK (config_version >= 1),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, config_key)
);

CREATE TABLE IF NOT EXISTS workspace_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_equipment_tenant_sort
  ON workspace_equipment (tenant_id, sort_order, name);

CREATE TABLE IF NOT EXISTS workspace_tour_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspace_tour_themes_tenant_sort
  ON workspace_tour_themes (tenant_id, sort_order, name);

CREATE TABLE IF NOT EXISTS workspace_guide_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspace_guide_languages_tenant_sort
  ON workspace_guide_languages (tenant_id, sort_order, name);

CREATE TABLE IF NOT EXISTS workspace_tour_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  theme_id UUID REFERENCES workspace_tour_themes(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_tour_presets_tenant_sort
  ON workspace_tour_presets (tenant_id, sort_order, name);

CREATE TABLE IF NOT EXISTS workspace_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_regions_tenant_sort
  ON workspace_regions (tenant_id, sort_order, name);

CREATE TABLE IF NOT EXISTS workspace_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES workspace_regions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_destinations_tenant_region
  ON workspace_destinations (tenant_id, region_id, sort_order, name);

CREATE TABLE IF NOT EXISTS operator_settings_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operator_settings_audit_tenant_occurred
  ON operator_settings_audit_events (tenant_id, occurred_at DESC);

ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_equipment FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_tour_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_tour_themes FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_guide_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_guide_languages FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_tour_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_tour_presets FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_regions FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_destinations FORCE ROW LEVEL SECURITY;
ALTER TABLE operator_settings_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_settings_audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_config_tenant_isolation ON tenant_config;
CREATE POLICY tenant_config_tenant_isolation ON tenant_config
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS workspace_equipment_tenant_isolation ON workspace_equipment;
CREATE POLICY workspace_equipment_tenant_isolation ON workspace_equipment
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS workspace_tour_themes_tenant_isolation ON workspace_tour_themes;
CREATE POLICY workspace_tour_themes_tenant_isolation ON workspace_tour_themes
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS workspace_guide_languages_tenant_isolation ON workspace_guide_languages;
CREATE POLICY workspace_guide_languages_tenant_isolation ON workspace_guide_languages
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS workspace_tour_presets_tenant_isolation ON workspace_tour_presets;
CREATE POLICY workspace_tour_presets_tenant_isolation ON workspace_tour_presets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS workspace_regions_tenant_isolation ON workspace_regions;
CREATE POLICY workspace_regions_tenant_isolation ON workspace_regions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS workspace_destinations_tenant_isolation ON workspace_destinations;
CREATE POLICY workspace_destinations_tenant_isolation ON workspace_destinations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS operator_settings_audit_events_tenant_isolation ON operator_settings_audit_events;
CREATE POLICY operator_settings_audit_events_tenant_isolation ON operator_settings_audit_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_config TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE workspace_equipment TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE workspace_tour_themes TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE workspace_guide_languages TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE workspace_tour_presets TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE workspace_regions TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE workspace_destinations TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE operator_settings_audit_events TO app_tour;
