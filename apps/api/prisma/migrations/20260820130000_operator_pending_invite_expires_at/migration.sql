-- P1.2 — operator pending invite TTL and lifecycle retention

ALTER TABLE operator_pending_invites
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE operator_pending_invites
SET expires_at = created_at + INTERVAL '7 days'
WHERE expires_at IS NULL;

ALTER TABLE operator_pending_invites
  ALTER COLUMN expires_at SET NOT NULL;
