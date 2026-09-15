-- TKT-001 Phase H1 — durable ticket notifications + delivery retry queue

CREATE TABLE IF NOT EXISTS ticket_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ticket_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  domain_event_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_notifications_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT ticket_notifications_recipient_event_key
    UNIQUE (tenant_id, user_id, domain_event_id),
  CONSTRAINT ticket_notifications_tenant_ticket_fkey
    FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets (tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ticket_notifications_tenant_user_created
  ON ticket_notifications (tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_notifications_tenant_user_read
  ON ticket_notifications (tenant_id, user_id, read_at);

CREATE TABLE IF NOT EXISTS ticket_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL,
  channel TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'noop',
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  last_error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT ticket_notification_deliveries_tenant_notification_fkey
    FOREIGN KEY (tenant_id, notification_id)
    REFERENCES ticket_notifications (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT ticket_notification_deliveries_channel_key
    UNIQUE (tenant_id, notification_id, channel),
  CONSTRAINT ticket_notification_deliveries_channel_check
    CHECK (channel IN ('email', 'sms')),
  CONSTRAINT ticket_notification_deliveries_status_check
    CHECK (status IN ('pending', 'delivered', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_notification_deliveries_claim
  ON ticket_notification_deliveries (status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_notification_deliveries_tenant_status
  ON ticket_notification_deliveries (tenant_id, status, created_at);

ALTER TABLE ticket_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_notifications_tenant_isolation ON ticket_notifications;
CREATE POLICY ticket_notifications_tenant_isolation ON ticket_notifications
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_notification_deliveries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_notification_deliveries_tenant_isolation ON ticket_notification_deliveries;
CREATE POLICY ticket_notification_deliveries_tenant_isolation ON ticket_notification_deliveries
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_notifications TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_notification_deliveries TO app_tour;
