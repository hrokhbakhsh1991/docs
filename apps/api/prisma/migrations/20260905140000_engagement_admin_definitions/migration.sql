-- MEG-001 — operator-managed engagement definitions (badges, levels, award rules, audit).

CREATE TABLE IF NOT EXISTS engagement_badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  code TEXT NOT NULL,
  title_i18n JSONB NOT NULL,
  description_i18n JSONB NOT NULL,
  icon_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  trigger_kind TEXT NOT NULL,
  trigger_event_type TEXT,
  trigger_min_points INTEGER,
  row_version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT engagement_badge_definitions_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT uq_engagement_badge_definitions_code UNIQUE (tenant_id, workspace_id, code),
  CONSTRAINT engagement_badge_definitions_status_check
    CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT engagement_badge_definitions_trigger_kind_check
    CHECK (trigger_kind IN ('event', 'points_threshold'))
);

CREATE INDEX IF NOT EXISTS idx_engagement_badge_definitions_tenant_workspace_status
  ON engagement_badge_definitions (tenant_id, workspace_id, status);

CREATE TABLE IF NOT EXISTS engagement_level_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  code TEXT NOT NULL,
  title_i18n JSONB NOT NULL,
  description_i18n JSONB NOT NULL,
  min_points INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT engagement_level_definitions_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT uq_engagement_level_definitions_code UNIQUE (tenant_id, workspace_id, code),
  CONSTRAINT engagement_level_definitions_status_check
    CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT engagement_level_definitions_min_points_check CHECK (min_points >= 0)
);

CREATE INDEX IF NOT EXISTS idx_engagement_level_definitions_tenant_workspace_points
  ON engagement_level_definitions (tenant_id, workspace_id, status, min_points);

CREATE TABLE IF NOT EXISTS engagement_award_rule_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_module TEXT NOT NULL,
  points INTEGER NOT NULL,
  badge_code TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  dedupe_policy TEXT NOT NULL DEFAULT 'per_user',
  version INTEGER NOT NULL DEFAULT 1,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT engagement_award_rule_definitions_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT uq_engagement_award_rule_definitions_version
    UNIQUE (tenant_id, workspace_id, event_type, version),
  CONSTRAINT engagement_award_rule_definitions_status_check
    CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT engagement_award_rule_definitions_dedupe_policy_check
    CHECK (dedupe_policy IN ('per_user', 'per_entity')),
  CONSTRAINT engagement_award_rule_definitions_points_check CHECK (points > 0)
);

CREATE INDEX IF NOT EXISTS idx_engagement_award_rule_definitions_active
  ON engagement_award_rule_definitions (tenant_id, workspace_id, status, effective_from);

CREATE TABLE IF NOT EXISTS engagement_definition_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID NOT NULL,
  actor_role TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT engagement_definition_audit_logs_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT engagement_definition_audit_logs_entity_type_check
    CHECK (entity_type IN ('badge', 'level', 'award_rule'))
);

CREATE INDEX IF NOT EXISTS idx_engagement_definition_audit_logs_tenant_created
  ON engagement_definition_audit_logs (tenant_id, workspace_id, created_at DESC);

ALTER TABLE engagement_badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_badge_definitions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_badge_definitions_tenant_isolation ON engagement_badge_definitions;
CREATE POLICY engagement_badge_definitions_tenant_isolation ON engagement_badge_definitions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE engagement_level_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_level_definitions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_level_definitions_tenant_isolation ON engagement_level_definitions;
CREATE POLICY engagement_level_definitions_tenant_isolation ON engagement_level_definitions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE engagement_award_rule_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_award_rule_definitions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_award_rule_definitions_tenant_isolation ON engagement_award_rule_definitions;
CREATE POLICY engagement_award_rule_definitions_tenant_isolation ON engagement_award_rule_definitions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE engagement_definition_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_definition_audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_definition_audit_logs_tenant_isolation ON engagement_definition_audit_logs;
CREATE POLICY engagement_definition_audit_logs_tenant_isolation ON engagement_definition_audit_logs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE engagement_badge_definitions TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE engagement_level_definitions TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE engagement_award_rule_definitions TO app_tour;
GRANT SELECT, INSERT ON TABLE engagement_definition_audit_logs TO app_tour;
