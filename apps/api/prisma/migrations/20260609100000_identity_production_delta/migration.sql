-- Phase 9.1 identity production delta (see infra/sql/010_identity_production_delta.sql)

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_mobile UNIQUE (mobile)
);

CREATE TABLE IF NOT EXISTS user_tenants (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  session_version INT NOT NULL DEFAULT 1,
  workspace_id TEXT,
  membership_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_status ON user_tenants (tenant_id, status);

ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_tenants_tenant_isolation ON user_tenants;
CREATE POLICY user_tenants_tenant_isolation ON user_tenants
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE IF NOT EXISTS mobile_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login',
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_otp_mobile_created
  ON mobile_otp_challenges (mobile, created_at DESC);

CREATE TABLE IF NOT EXISTS operator_pending_invites (
  invite_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_token UUID NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'INVITED',
  name_note TEXT,
  invited_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operator_pending_invites_tenant_status
  ON operator_pending_invites (tenant_id, status);
