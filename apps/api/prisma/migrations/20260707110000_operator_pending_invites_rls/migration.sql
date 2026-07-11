-- Phase 5 — RLS on operator_pending_invites (identity invite paths)
-- Mirror operator_registrations tenant isolation policy.

ALTER TABLE operator_pending_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_pending_invites FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operator_pending_invites_tenant_isolation ON operator_pending_invites;
CREATE POLICY operator_pending_invites_tenant_isolation ON operator_pending_invites
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
