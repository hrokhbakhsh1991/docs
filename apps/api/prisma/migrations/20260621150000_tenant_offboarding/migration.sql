ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS offboarding_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_scheduled_deletion
  ON tenants (scheduled_deletion_at)
  WHERE status = 'offboarding';
