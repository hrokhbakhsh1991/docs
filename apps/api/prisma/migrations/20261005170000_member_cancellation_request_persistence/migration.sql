ALTER TABLE operator_registrations
  ADD COLUMN IF NOT EXISTS cancellation_rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_rejected_by_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_operator_registrations_tenant_cancellation_pending
  ON operator_registrations (tenant_id, cancellation_requested_at, id)
  WHERE cancellation_status = 'request_pending';
