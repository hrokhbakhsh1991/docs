-- Phase 11.2 — workspace draft snapshots (DEC-P11-003)

CREATE TABLE IF NOT EXISTS workspace_draft_snapshots (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  draft_namespace TEXT NOT NULL,
  draft_key TEXT NOT NULL,
  schema_version INT NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  version INT NOT NULL CHECK (version >= 1),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_modified BIGINT NOT NULL DEFAULT 0,
  updated_by_user_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, workspace_id, user_id, draft_namespace, draft_key)
);

CREATE INDEX IF NOT EXISTS idx_workspace_draft_snapshots_scope
  ON workspace_draft_snapshots (tenant_id, workspace_id, user_id);

ALTER TABLE workspace_draft_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_draft_snapshots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_draft_snapshots_tenant_isolation ON workspace_draft_snapshots;
CREATE POLICY workspace_draft_snapshots_tenant_isolation ON workspace_draft_snapshots
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE workspace_draft_snapshots TO app_tour;
