-- SMS usage ledger: immutable accounting boundary for provider delivery attempts.
CREATE TABLE IF NOT EXISTS sms_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_type TEXT,
  delivery_job_id UUID NOT NULL REFERENCES integration_delivery_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  provider TEXT NOT NULL,
  purpose TEXT NOT NULL,
  template_key TEXT,
  recipient_hash TEXT NOT NULL,
  provider_message_id TEXT,
  segment_count INTEGER,
  unit_cost INTEGER,
  total_cost INTEGER,
  status TEXT NOT NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sms_usage_delivery_attempt UNIQUE (delivery_job_id, attempt_number),
  CONSTRAINT sms_usage_events_status_check CHECK (status IN ('attempted', 'sent', 'failed', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_sms_usage_tenant_workspace_created
  ON sms_usage_events (tenant_id, workspace_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_usage_tenant_purpose_created
  ON sms_usage_events (tenant_id, purpose, created_at DESC);

ALTER TABLE sms_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_usage_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_usage_events_tenant_isolation ON sms_usage_events;
CREATE POLICY sms_usage_events_tenant_isolation ON sms_usage_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE ON TABLE sms_usage_events TO app_tour;
