ALTER TABLE operator_registrations
  ADD COLUMN IF NOT EXISTS cancellation_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cancellation_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason_note TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_approved_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS cancellation_correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_operator_registrations_tenant_cancellation_status
  ON operator_registrations (tenant_id, cancellation_status, updated_at DESC);
