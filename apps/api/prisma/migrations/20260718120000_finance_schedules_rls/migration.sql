-- Phase 9.7 R3 — durable installment schedules (FinanceSchedule) + tenant RLS

CREATE TABLE IF NOT EXISTS finance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL,
  sequence INTEGER NOT NULL,
  label TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  amount_minor TEXT NOT NULL,
  paid_minor TEXT NOT NULL DEFAULT '0',
  status TEXT NOT NULL,
  linked_payment_id UUID,
  grace_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_schedules_tenant_registration_sequence_key UNIQUE (tenant_id, registration_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_finance_schedules_tenant_registration
  ON finance_schedules (tenant_id, registration_id);
CREATE INDEX IF NOT EXISTS idx_finance_schedules_tenant_status
  ON finance_schedules (tenant_id, status);

ALTER TABLE finance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_schedules_tenant_isolation ON finance_schedules;
CREATE POLICY finance_schedules_tenant_isolation ON finance_schedules
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE finance_schedules TO app_tour;
