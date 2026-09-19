-- DEN-EXEC-01 — durable tour execution and driver attendance facts.
-- This migration intentionally creates no finance/wallet side effect.

CREATE TABLE tour_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by_user_id UUID NOT NULL,
  completed_by_user_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tour_executions_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT tour_executions_tenant_tour_key UNIQUE (tenant_id, tour_id),
  CONSTRAINT tour_executions_tenant_tour_fkey
    FOREIGN KEY (tenant_id, tour_id) REFERENCES tours (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT tour_executions_status_check
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT tour_executions_version_check CHECK (version >= 1)
);

CREATE INDEX idx_tour_executions_tenant_status_updated
  ON tour_executions (tenant_id, status, updated_at);

CREATE TABLE driver_execution_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL,
  driver_registration_id UUID NOT NULL,
  offered_passenger_capacity INTEGER NOT NULL,
  actual_passenger_count INTEGER NOT NULL DEFAULT 0,
  attendance_status TEXT NOT NULL DEFAULT 'not_arrived',
  version INTEGER NOT NULL DEFAULT 1,
  last_edited_by_user_id UUID NOT NULL,
  last_edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_execution_facts_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT driver_execution_facts_execution_driver_key
    UNIQUE (tenant_id, execution_id, driver_registration_id),
  CONSTRAINT driver_execution_facts_execution_fkey
    FOREIGN KEY (tenant_id, execution_id) REFERENCES tour_executions (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT driver_execution_facts_capacity_check CHECK (offered_passenger_capacity >= 0),
  CONSTRAINT driver_execution_facts_actual_check
    CHECK (actual_passenger_count >= 0 AND actual_passenger_count <= offered_passenger_capacity),
  CONSTRAINT driver_execution_facts_attendance_check
    CHECK (attendance_status IN ('not_arrived', 'present', 'departed', 'cancelled')),
  CONSTRAINT driver_execution_facts_version_check CHECK (version >= 1)
);

CREATE INDEX idx_driver_execution_facts_tenant_execution_attendance
  ON driver_execution_facts (tenant_id, execution_id, attendance_status);

CREATE TABLE driver_execution_fact_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fact_id UUID NOT NULL,
  sequence INTEGER NOT NULL,
  previous_actual_passenger_count INTEGER NOT NULL,
  next_actual_passenger_count INTEGER NOT NULL,
  previous_attendance_status TEXT NOT NULL,
  next_attendance_status TEXT NOT NULL,
  reason TEXT,
  actor_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_execution_fact_audit_sequence_key UNIQUE (tenant_id, fact_id, sequence),
  CONSTRAINT driver_execution_fact_audit_fact_fkey
    FOREIGN KEY (tenant_id, fact_id) REFERENCES driver_execution_facts (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT driver_execution_fact_audit_previous_count_check CHECK (previous_actual_passenger_count >= 0),
  CONSTRAINT driver_execution_fact_audit_next_count_check CHECK (next_actual_passenger_count >= 0),
  CONSTRAINT driver_execution_fact_audit_previous_attendance_check
    CHECK (previous_attendance_status IN ('not_arrived', 'present', 'departed', 'cancelled')),
  CONSTRAINT driver_execution_fact_audit_next_attendance_check
    CHECK (next_attendance_status IN ('not_arrived', 'present', 'departed', 'cancelled'))
);

CREATE INDEX idx_driver_execution_fact_audit_tenant_fact_created
  ON driver_execution_fact_audit (tenant_id, fact_id, created_at);

ALTER TABLE tour_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_executions FORCE ROW LEVEL SECURITY;
CREATE POLICY tour_executions_tenant_isolation ON tour_executions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE driver_execution_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_execution_facts FORCE ROW LEVEL SECURITY;
CREATE POLICY driver_execution_facts_tenant_isolation ON driver_execution_facts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE driver_execution_fact_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_execution_fact_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY driver_execution_fact_audit_tenant_isolation ON driver_execution_fact_audit
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tour_executions TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE driver_execution_facts TO app_tour;
-- Audit rows are created with the fact mutation and are never edited or deleted.
GRANT SELECT, INSERT ON TABLE driver_execution_fact_audit TO app_tour;
