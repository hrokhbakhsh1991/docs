-- TKT-001 Phase E1 — fix object_key CHECK segment count (ticketId/messageId/attachmentId).

ALTER TABLE ticket_attachments
  DROP CONSTRAINT IF EXISTS ticket_attachments_object_key_tenant_scoped_check;

ALTER TABLE ticket_attachments
  ADD CONSTRAINT ticket_attachments_object_key_tenant_scoped_check
    CHECK (object_key LIKE 'tickets/' || tenant_id::text || '/%/%/%');
