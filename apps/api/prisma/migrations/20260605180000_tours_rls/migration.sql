-- P0-1 / DEC-024 — tours RLS (mirrors infra/sql/001_tenant_rls.sql tenant_isolation policy)

ALTER TABLE "tours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tours" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "tours";
CREATE POLICY tenant_isolation ON "tours"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
