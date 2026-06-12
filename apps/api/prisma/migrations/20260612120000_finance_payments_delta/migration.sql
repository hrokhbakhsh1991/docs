-- Phase 9.7 — payments + receipt review (see infra/sql/008_finance_payments_delta.sql)

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  registration_id UUID NOT NULL,
  amount TEXT NOT NULL,
  currency VARCHAR(8) NOT NULL,
  method TEXT NOT NULL DEFAULT 'Manual',
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  ledger_journal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON payments (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_registration ON payments (tenant_id, registration_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_tenant_isolation ON payments;
CREATE POLICY payments_tenant_isolation ON payments
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  file_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  note TEXT,
  reviewed_by_user_id TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  ledger_journal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_tenant_status ON payment_receipts (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_tenant_payment ON payment_receipts (tenant_id, payment_id);

ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_receipts_tenant_isolation ON payment_receipts;
CREATE POLICY payment_receipts_tenant_isolation ON payment_receipts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payments TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payment_receipts TO app_tour;
