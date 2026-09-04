-- MNI-001 / SK2.D+ — unified member notification inbox

CREATE TABLE IF NOT EXISTS member_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_module TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  title_key TEXT,
  body_key TEXT,
  template_key TEXT,
  dedupe_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT member_notifications_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT uq_member_notifications_recipient_dedupe UNIQUE (tenant_id, user_id, dedupe_key),
  CONSTRAINT member_notifications_source_module_check
    CHECK (source_module IN ('ticketing', 'booking', 'finance', 'wallet')),
  CONSTRAINT member_notifications_entity_type_check
    CHECK (entity_type IN ('ticket', 'registration', 'payment', 'wallet_event'))
);

CREATE INDEX IF NOT EXISTS idx_member_notifications_tenant_user_created
  ON member_notifications (tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_notifications_tenant_user_read
  ON member_notifications (tenant_id, user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_member_notifications_tenant_entity
  ON member_notifications (tenant_id, source_module, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS member_notification_deliveries (
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
  CONSTRAINT member_notification_deliveries_tenant_notification_fkey
    FOREIGN KEY (tenant_id, notification_id)
    REFERENCES member_notifications (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_member_notification_deliveries_channel
    UNIQUE (tenant_id, notification_id, channel),
  CONSTRAINT member_notification_deliveries_channel_check
    CHECK (channel IN ('email', 'sms')),
  CONSTRAINT member_notification_deliveries_status_check
    CHECK (status IN ('pending', 'delivered', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_member_notification_deliveries_claim
  ON member_notification_deliveries (status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_member_notification_deliveries_tenant_status
  ON member_notification_deliveries (tenant_id, status, created_at);

ALTER TABLE member_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_notifications_tenant_isolation ON member_notifications;
CREATE POLICY member_notifications_tenant_isolation ON member_notifications
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE member_notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_notification_deliveries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_notification_deliveries_tenant_isolation ON member_notification_deliveries;
CREATE POLICY member_notification_deliveries_tenant_isolation ON member_notification_deliveries
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE member_notifications TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE member_notification_deliveries TO app_tour;
