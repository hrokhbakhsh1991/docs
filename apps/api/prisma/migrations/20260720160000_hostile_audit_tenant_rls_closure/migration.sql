-- Hostile audit PREV-AUD-002 / TODO-002 / TODO-011
-- Close app_cloud DML holes on tenant-scoped and identity tables that lacked RLS.
-- Platform/catalog tables used via DATABASE_URL_ADMIN keep FORCE RLS with no app_cloud policies (deny).

-- ─── urban_registrations ─────────────────────────────────────────────
ALTER TABLE urban_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE urban_registrations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS urban_registrations_tenant_isolation ON urban_registrations;
CREATE POLICY urban_registrations_tenant_isolation ON urban_registrations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_cloud') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE urban_registrations TO app_cloud;
  END IF;
END $$;

-- ─── tenant_domains (platform uses admin; deny app_cloud) ────────────
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_domains_tenant_isolation ON tenant_domains;
-- No policy for app_cloud → deny all under FORCE RLS

-- ─── tenant_routes ───────────────────────────────────────────────────
ALTER TABLE tenant_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_routes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_routes_tenant_isolation ON tenant_routes;
CREATE POLICY tenant_routes_tenant_isolation ON tenant_routes
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ─── tenant_subscriptions (if present) ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'tenant_subscriptions') THEN
    EXECUTE 'ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE tenant_subscriptions FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_subscriptions_tenant_isolation ON tenant_subscriptions';
    EXECUTE $p$
      CREATE POLICY tenant_subscriptions_tenant_isolation ON tenant_subscriptions
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END $$;

-- ─── operator_user_role_audit ────────────────────────────────────────
ALTER TABLE operator_user_role_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_user_role_audit FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_user_role_audit_tenant_isolation ON operator_user_role_audit;
CREATE POLICY operator_user_role_audit_tenant_isolation ON operator_user_role_audit
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ─── outbox_replay_runs (nullable tenant_id; ops via admin preferred) ─
ALTER TABLE outbox_replay_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_replay_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_replay_runs_tenant_isolation ON outbox_replay_runs;
CREATE POLICY outbox_replay_runs_tenant_isolation ON outbox_replay_runs
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ─── users: SELECT only for members of current tenant; mutations via admin
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_tenant_member_select ON users;
CREATE POLICY users_tenant_member_select ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_tenants ut
      WHERE ut.user_id = users.id
        AND ut.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );

-- ─── mobile_otp_challenges: deny app_cloud (identity uses admin) ─────
ALTER TABLE mobile_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_otp_challenges FORCE ROW LEVEL SECURITY;
-- no policies → deny for non-bypass roles

-- ─── platform tables (admin-only; deny app_cloud) ────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'platform_ops_users',
    'platform_audit_events',
    'platform_plans',
    'tenants',
    'workspace_definitions',
    'workspace_definition_versions'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Stop insecure-by-default for future tables created by postgres role in this DB.
-- New tables must grant + RLS explicitly in migrations.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_cloud') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM app_cloud;
  END IF;
END $$;
