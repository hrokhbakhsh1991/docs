-- TKT-001 Phase B1 — ticketing core persistence + tenant RLS (wallet/finance standard)

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL,
  assignee_user_id UUID,
  category_code VARCHAR(64) NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  subject VARCHAR(200) NOT NULL,
  creation_idempotency_key TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tickets_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT tickets_tenant_creation_idempotency_key_key
    UNIQUE (tenant_id, creation_idempotency_key),
  CONSTRAINT tickets_status_check
    CHECK (status IN ('open', 'pending_member', 'resolved', 'closed')),
  CONSTRAINT tickets_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT tickets_subject_length_check
    CHECK (char_length(subject) >= 3 AND char_length(subject) <= 200),
  CONSTRAINT tickets_category_code_length_check
    CHECK (char_length(category_code) >= 2 AND char_length(category_code) <= 64)
);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status_last_activity
  ON tickets (tenant_id, status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_requester_created
  ON tickets (tenant_id, requester_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_assignee_status
  ON tickets (tenant_id, assignee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_priority_last_activity
  ON tickets (tenant_id, priority, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_category_last_activity
  ON tickets (tenant_id, category_code, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL,
  author_user_id UUID NOT NULL,
  visibility TEXT NOT NULL,
  body TEXT NOT NULL,
  idempotency_key VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_messages_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT ticket_messages_tenant_ticket_idempotency_key_key
    UNIQUE (tenant_id, ticket_id, idempotency_key),
  CONSTRAINT ticket_messages_tenant_ticket_fkey
    FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT ticket_messages_visibility_check
    CHECK (visibility IN ('public', 'internal')),
  CONSTRAINT ticket_messages_body_length_check
    CHECK (char_length(body) >= 1 AND char_length(body) <= 10000)
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_tenant_ticket_created
  ON ticket_messages (tenant_id, ticket_id, created_at);

CREATE TABLE IF NOT EXISTS ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL,
  actor_user_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_events_tenant_ticket_fkey
    FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets (tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ticket_events_tenant_ticket_created
  ON ticket_events (tenant_id, ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_events_tenant_created
  ON ticket_events (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL,
  message_id UUID,
  uploaded_by_user_id UUID NOT NULL,
  object_key TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ticket_attachments_tenant_ticket_fkey
    FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT ticket_attachments_tenant_message_fkey
    FOREIGN KEY (tenant_id, message_id) REFERENCES ticket_messages (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT ticket_attachments_size_bytes_check
    CHECK (size_bytes > 0 AND size_bytes <= 8388608),
  CONSTRAINT ticket_attachments_object_key_tenant_scoped_check
    CHECK (object_key LIKE 'tickets/' || tenant_id::text || '/%')
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_tenant_ticket_created
  ON ticket_attachments (tenant_id, ticket_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_links_tenant_ticket_fkey
    FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_ticket_links_tenant_ticket_entity
    UNIQUE (tenant_id, ticket_id, entity_type, entity_id),
  CONSTRAINT ticket_links_entity_type_check
    CHECK (entity_type IN ('tour', 'registration', 'payment', 'wallet'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_links_tenant_entity
  ON ticket_links (tenant_id, entity_type, entity_id);

-- Tenant RLS (ENABLE + FORCE)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tickets_tenant_isolation ON tickets;
CREATE POLICY tickets_tenant_isolation ON tickets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_messages_tenant_isolation ON ticket_messages;
CREATE POLICY ticket_messages_tenant_isolation ON ticket_messages
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_events_tenant_isolation ON ticket_events;
CREATE POLICY ticket_events_tenant_isolation ON ticket_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_attachments_tenant_isolation ON ticket_attachments;
CREATE POLICY ticket_attachments_tenant_isolation ON ticket_attachments
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_links_tenant_isolation ON ticket_links;
CREATE POLICY ticket_links_tenant_isolation ON ticket_links
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tickets TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_messages TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_events TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_attachments TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_links TO app_tour;
