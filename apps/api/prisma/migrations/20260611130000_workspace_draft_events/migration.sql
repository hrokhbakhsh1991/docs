-- Phase 11.9 — workspace draft audit events (append-only)

CREATE TABLE IF NOT EXISTS workspace_draft_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  draft_namespace TEXT NOT NULL,
  draft_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  version INT CHECK (version IS NULL OR version >= 1),
  schema_version INT NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  actor_user_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_draft_events_scope
  ON workspace_draft_events (
    tenant_id,
    workspace_id,
    user_id,
    draft_namespace,
    draft_key,
    occurred_at DESC
  );

ALTER TABLE workspace_draft_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_draft_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_draft_events_tenant_isolation ON workspace_draft_events;
CREATE POLICY workspace_draft_events_tenant_isolation ON workspace_draft_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT ON TABLE workspace_draft_events TO app_tour;
