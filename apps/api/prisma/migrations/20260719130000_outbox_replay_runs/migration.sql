-- Phase 3.17 — production outbox replay audit runs (ops; no outbox schema change)

CREATE TABLE IF NOT EXISTS outbox_replay_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  actor_user_id TEXT,
  tenant_id UUID REFERENCES tenants(id),
  workspace_type TEXT,
  from_created_at TIMESTAMPTZ,
  to_created_at TIMESTAMPTZ,
  event_type_prefix TEXT,
  requested_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  replayed INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_replay_runs_created
  ON outbox_replay_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbox_replay_runs_tenant
  ON outbox_replay_runs (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

GRANT SELECT, INSERT ON TABLE outbox_replay_runs TO app_cloud;
