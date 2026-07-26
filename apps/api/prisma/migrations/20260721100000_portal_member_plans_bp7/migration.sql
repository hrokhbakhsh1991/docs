-- SK3 BP-7 — tenant-scoped portal member plans (MPS-ENT plan tables)

CREATE TABLE IF NOT EXISTS portal_member_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  module_grants JSONB NOT NULL DEFAULT '[]'::jsonb,
  capability_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_member_plans_tenant_code
  ON portal_member_plans (tenant_id, plan_code);

CREATE INDEX IF NOT EXISTS idx_portal_member_plans_tenant_active
  ON portal_member_plans (tenant_id, active);

ALTER TABLE portal_member_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY portal_member_plans_tenant_isolation ON portal_member_plans
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
