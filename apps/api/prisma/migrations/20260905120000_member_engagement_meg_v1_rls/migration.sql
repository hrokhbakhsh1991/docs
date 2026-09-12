-- MEG-001 — member engagement profiles, immutable point events, badges + tenant RLS

CREATE TABLE IF NOT EXISTS engagement_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  total_points INT NOT NULL DEFAULT 0,
  current_level_code TEXT NOT NULL DEFAULT 'base_camp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT engagement_profiles_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT engagement_profiles_tenant_workspace_user_key
    UNIQUE (tenant_id, workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_engagement_profiles_tenant_workspace_points
  ON engagement_profiles (tenant_id, workspace_id, total_points DESC);

CREATE TABLE IF NOT EXISTS engagement_point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  points_delta INT NOT NULL,
  source_module TEXT NOT NULL,
  source_event_type TEXT NOT NULL,
  source_entity_id UUID,
  dedupe_key TEXT NOT NULL,
  reverses_event_id UUID,
  actor_user_id UUID,
  actor_role TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT engagement_point_events_tenant_profile_fkey
    FOREIGN KEY (tenant_id, profile_id) REFERENCES engagement_profiles(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT engagement_point_events_tenant_dedupe_key UNIQUE (tenant_id, dedupe_key),
  CONSTRAINT engagement_point_events_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT engagement_point_events_no_self_reversal
    CHECK (reverses_event_id IS NULL OR reverses_event_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_engagement_point_events_tenant_user_created
  ON engagement_point_events (tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_point_events_tenant_workspace_created
  ON engagement_point_events (tenant_id, workspace_id, created_at DESC);

ALTER TABLE engagement_point_events
  ADD CONSTRAINT engagement_point_events_reversal_fkey
  FOREIGN KEY (tenant_id, reverses_event_id)
  REFERENCES engagement_point_events(tenant_id, id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS member_engagement_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  badge_code TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dedupe_key TEXT NOT NULL,
  CONSTRAINT member_engagement_badges_tenant_profile_fkey
    FOREIGN KEY (tenant_id, profile_id) REFERENCES engagement_profiles(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT member_engagement_badges_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT uq_member_engagement_badges_user_badge UNIQUE (tenant_id, user_id, badge_code),
  CONSTRAINT uq_member_engagement_badges_dedupe UNIQUE (tenant_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_member_engagement_badges_tenant_workspace_earned
  ON member_engagement_badges (tenant_id, workspace_id, earned_at DESC);

-- Tenant RLS (ENABLE + FORCE)
ALTER TABLE engagement_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_profiles_tenant_isolation ON engagement_profiles;
CREATE POLICY engagement_profiles_tenant_isolation ON engagement_profiles
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE engagement_point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_point_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_point_events_tenant_isolation ON engagement_point_events;
CREATE POLICY engagement_point_events_tenant_isolation ON engagement_point_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE member_engagement_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_engagement_badges FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_engagement_badges_tenant_isolation ON member_engagement_badges;
CREATE POLICY member_engagement_badges_tenant_isolation ON member_engagement_badges
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Append-only point events (corrections via compensating entries)
CREATE OR REPLACE FUNCTION reject_engagement_point_events_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'engagement_point_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS engagement_point_events_append_only ON engagement_point_events;
CREATE TRIGGER engagement_point_events_append_only
  BEFORE UPDATE OR DELETE ON engagement_point_events
  FOR EACH ROW
  EXECUTE FUNCTION reject_engagement_point_events_mutation();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE engagement_profiles TO app_tour;
GRANT SELECT, INSERT ON TABLE engagement_point_events TO app_tour;
GRANT SELECT, INSERT ON TABLE member_engagement_badges TO app_tour;
