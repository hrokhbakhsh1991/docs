-- Finance recon — tenant RLS to Booking / payments standard.
-- app_tour already has DML grants (20260719120000); without RLS those grants
-- allowed cross-tenant reads/writes. ENABLE+FORCE + isolation policies close the hole.
-- Admin/ops (DATABASE_URL_ADMIN / postgres) still bypasses for cross-tenant scan jobs.

ALTER TABLE finance_recon_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_recon_findings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_recon_findings_tenant_isolation ON finance_recon_findings;
CREATE POLICY finance_recon_findings_tenant_isolation ON finance_recon_findings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE finance_recon_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_recon_actions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_recon_actions_tenant_isolation ON finance_recon_actions;
CREATE POLICY finance_recon_actions_tenant_isolation ON finance_recon_actions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE finance_recon_findings TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE finance_recon_actions TO app_tour;
