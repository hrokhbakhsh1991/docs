-- PR23-E2 — durable finance refunds + tenant RLS

CREATE TABLE IF NOT EXISTS finance_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL,
  payment_id UUID,
  source_kind TEXT NOT NULL,
  amount_minor TEXT NOT NULL,
  currency VARCHAR(8) NOT NULL,
  reason_code TEXT NOT NULL,
  reason_note TEXT,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by_user_id TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by_user_id TEXT,
  reject_note TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by_user_id TEXT,
  completed_at TIMESTAMPTZ,
  completed_by_user_id TEXT,
  completion_note TEXT,
  evidence_file_key TEXT,
  evidence_note TEXT,
  creation_idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_refunds_tenant_creation_idempotency_key UNIQUE (tenant_id, creation_idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_finance_refunds_tenant_registration
  ON finance_refunds (tenant_id, registration_id);
CREATE INDEX IF NOT EXISTS idx_finance_refunds_tenant_payment
  ON finance_refunds (tenant_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_finance_refunds_tenant_status
  ON finance_refunds (tenant_id, status);

ALTER TABLE finance_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_refunds FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_refunds_tenant_isolation ON finance_refunds;
CREATE POLICY finance_refunds_tenant_isolation ON finance_refunds
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE finance_refunds TO app_cloud;
