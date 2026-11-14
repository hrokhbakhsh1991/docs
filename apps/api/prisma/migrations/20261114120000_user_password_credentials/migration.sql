-- Global identity credentials are never accessible through the tenant app role.
CREATE TABLE user_password_credentials (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_password_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_password_credentials FORCE ROW LEVEL SECURITY;

-- Existing OTP rows remain login challenges. Credential challenges require a
-- bound user and tenant; application verification must also check the mobile.
ALTER TABLE mobile_otp_challenges
  ADD COLUMN tenant_id UUID,
  ADD COLUMN user_id UUID,
  ADD CONSTRAINT password_otp_scope_required
    CHECK (purpose <> 'password_change' OR (tenant_id IS NOT NULL AND user_id IS NOT NULL));
