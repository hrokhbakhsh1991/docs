-- TKT-001 Phase E1 — allow pending uploads to record byte size before complete.

ALTER TABLE ticket_attachments
  DROP CONSTRAINT IF EXISTS ticket_attachments_size_bytes_check;

ALTER TABLE ticket_attachments
  ADD CONSTRAINT ticket_attachments_size_bytes_check
    CHECK (
      size_bytes >= 0
      AND size_bytes <= 10485760
      AND (scan_status = 'pending' OR size_bytes > 0)
    );
