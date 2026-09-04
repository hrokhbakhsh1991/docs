-- TKT-001 Phase I1 — ticketing SLA policies, state, escalation activations + on-hold pause

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS on_hold BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS on_hold_reason TEXT;

CREATE TABLE IF NOT EXISTS ticket_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  name TEXT NOT NULL,
  workspace_type TEXT,
  category_code VARCHAR(64),
  priority TEXT,
  queue_id UUID,
  first_response_minutes INTEGER NOT NULL,
  next_response_minutes INTEGER NOT NULL,
  resolution_minutes INTEGER NOT NULL,
  business_hours_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  escalation_steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  warning_threshold_percent INTEGER NOT NULL DEFAULT 80,
  enabled BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_sla_policies_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT ticket_sla_policies_tenant_code_key UNIQUE (tenant_id, code),
  CONSTRAINT ticket_sla_policies_tenant_queue_fkey
    FOREIGN KEY (tenant_id, queue_id) REFERENCES ticket_queues (tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT ticket_sla_policies_minutes_check
    CHECK (
      first_response_minutes > 0
      AND next_response_minutes > 0
      AND resolution_minutes > 0
      AND warning_threshold_percent BETWEEN 1 AND 99
    )
);

CREATE INDEX IF NOT EXISTS idx_ticket_sla_policies_tenant_enabled
  ON ticket_sla_policies (tenant_id, enabled);

CREATE TABLE IF NOT EXISTS ticket_sla_states (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  first_response_due_at TIMESTAMPTZ,
  next_response_due_at TIMESTAMPTZ,
  resolution_due_at TIMESTAMPTZ,
  first_responded_at TIMESTAMPTZ,
  last_member_message_at TIMESTAMPTZ,
  breached_at TIMESTAMPTZ,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  paused_at TIMESTAMPTZ,
  paused_ms INTEGER NOT NULL DEFAULT 0,
  first_response_warning_at TIMESTAMPTZ,
  next_response_warning_at TIMESTAMPTZ,
  resolution_warning_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, ticket_id),
  CONSTRAINT ticket_sla_states_tenant_ticket_fkey
    FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT ticket_sla_states_tenant_policy_fkey
    FOREIGN KEY (tenant_id, policy_id) REFERENCES ticket_sla_policies (tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ticket_sla_states_first_due
  ON ticket_sla_states (tenant_id, first_response_due_at);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_states_next_due
  ON ticket_sla_states (tenant_id, next_response_due_at);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_states_resolution_due
  ON ticket_sla_states (tenant_id, resolution_due_at);

CREATE TABLE IF NOT EXISTS ticket_sla_escalation_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL,
  escalation_level INTEGER NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ticket_sla_escalation_activations
    UNIQUE (tenant_id, ticket_id, escalation_level)
);

ALTER TABLE ticket_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_sla_policies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_sla_policies_tenant_isolation ON ticket_sla_policies;
CREATE POLICY ticket_sla_policies_tenant_isolation ON ticket_sla_policies
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_sla_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_sla_states FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_sla_states_tenant_isolation ON ticket_sla_states;
CREATE POLICY ticket_sla_states_tenant_isolation ON ticket_sla_states
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_sla_escalation_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_sla_escalation_activations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_sla_escalation_activations_tenant_isolation ON ticket_sla_escalation_activations;
CREATE POLICY ticket_sla_escalation_activations_tenant_isolation ON ticket_sla_escalation_activations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_sla_policies TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_sla_states TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_sla_escalation_activations TO app_tour;
