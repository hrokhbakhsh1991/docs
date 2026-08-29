-- DP1 staging hardening — finance_payment_holds app-role RLS + grants.

ALTER TABLE finance_payment_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payment_holds FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_payment_holds_tenant_isolation ON finance_payment_holds;
CREATE POLICY finance_payment_holds_tenant_isolation ON finance_payment_holds
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE finance_payment_holds TO app_tour;
