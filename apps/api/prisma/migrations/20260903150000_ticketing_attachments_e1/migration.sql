-- TKT-001 Phase E1 — attachment upload intents, scan status, idempotency.

ALTER TABLE ticket_attachments
  ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS upload_intent_expires_at TIMESTAMPTZ;

ALTER TABLE ticket_attachments
  DROP CONSTRAINT IF EXISTS ticket_attachments_size_bytes_check,
  DROP CONSTRAINT IF EXISTS ticket_attachments_object_key_tenant_scoped_check;

ALTER TABLE ticket_attachments
  ADD CONSTRAINT ticket_attachments_scan_status_check
    CHECK (scan_status IN ('pending', 'clean', 'rejected', 'failed')),
  ADD CONSTRAINT ticket_attachments_size_bytes_check
    CHECK (
      size_bytes >= 0
      AND size_bytes <= 10485760
      AND (scan_status = 'pending' OR size_bytes > 0)
    ),
  ADD CONSTRAINT ticket_attachments_object_key_tenant_scoped_check
    CHECK (object_key LIKE 'tickets/' || tenant_id::text || '/%/%/%');

CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_attachments_tenant_idempotency_key
  ON ticket_attachments (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
