-- ITO-001 — In-Tour Operations persistence (tenant-scoped, FORCE RLS)

CREATE TABLE IF NOT EXISTS tour_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  row_version INT NOT NULL DEFAULT 0,
  tour_leader_user_id UUID,
  scheduled_meeting_at TIMESTAMPTZ,
  meeting_location TEXT,
  manifest_locked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tour_executions_active_tour
  ON tour_executions (tenant_id, tour_id)
  WHERE state NOT IN ('completed', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_tour_executions_tenant_state
  ON tour_executions (tenant_id, state, updated_at DESC);

CREATE TABLE IF NOT EXISTS tour_execution_manifest_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES tour_executions(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL,
  guest_label TEXT NOT NULL,
  party_size INT NOT NULL,
  registration_status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  insurance_status TEXT,
  group_id UUID,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, execution_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_execution_manifest_execution
  ON tour_execution_manifest_rows (tenant_id, execution_id, sort_order);

CREATE TABLE IF NOT EXISTS tour_execution_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES tour_executions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_user_id UUID,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_execution_groups_execution
  ON tour_execution_groups (tenant_id, execution_id, sort_order);

CREATE TABLE IF NOT EXISTS tour_execution_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES tour_executions(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  label TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by_user_id UUID,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_execution_checklist_execution
  ON tour_execution_checklist_items (tenant_id, execution_id, phase, sort_order);

CREATE TABLE IF NOT EXISTS tour_execution_operational_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES tour_executions(id) ON DELETE CASCADE,
  event_kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  description TEXT NOT NULL,
  reported_by_user_id UUID NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tour_execution_operational_events_execution
  ON tour_execution_operational_events (tenant_id, execution_id, reported_at DESC);

CREATE TABLE IF NOT EXISTS tour_execution_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES tour_executions(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB NOT NULL,
  actor_user_id UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tour_execution_change_idempotency
  ON tour_execution_change_logs (tenant_id, execution_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tour_execution_change_logs_execution
  ON tour_execution_change_logs (tenant_id, execution_id, changed_at DESC);

-- RLS
ALTER TABLE tour_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_executions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_executions_tenant_isolation ON tour_executions;
CREATE POLICY tour_executions_tenant_isolation ON tour_executions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE tour_execution_manifest_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_execution_manifest_rows FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_execution_manifest_rows_tenant_isolation ON tour_execution_manifest_rows;
CREATE POLICY tour_execution_manifest_rows_tenant_isolation ON tour_execution_manifest_rows
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE tour_execution_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_execution_groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_execution_groups_tenant_isolation ON tour_execution_groups;
CREATE POLICY tour_execution_groups_tenant_isolation ON tour_execution_groups
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE tour_execution_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_execution_checklist_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_execution_checklist_items_tenant_isolation ON tour_execution_checklist_items;
CREATE POLICY tour_execution_checklist_items_tenant_isolation ON tour_execution_checklist_items
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE tour_execution_operational_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_execution_operational_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_execution_operational_events_tenant_isolation ON tour_execution_operational_events;
CREATE POLICY tour_execution_operational_events_tenant_isolation ON tour_execution_operational_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE tour_execution_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_execution_change_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_execution_change_logs_tenant_isolation ON tour_execution_change_logs;
CREATE POLICY tour_execution_change_logs_tenant_isolation ON tour_execution_change_logs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON tour_executions TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON tour_execution_manifest_rows TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON tour_execution_groups TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON tour_execution_checklist_items TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON tour_execution_operational_events TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON tour_execution_change_logs TO app_tour;
