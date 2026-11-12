ALTER TABLE integration_delivery_jobs
  ALTER COLUMN tenant_id DROP NOT NULL;

ALTER TABLE integration_delivery_jobs
  ADD COLUMN delivery_scope TEXT NOT NULL DEFAULT 'tenant';

ALTER TABLE integration_delivery_jobs
  ADD CONSTRAINT integration_delivery_jobs_scope_check
  CHECK (
    (delivery_scope = 'tenant' AND tenant_id IS NOT NULL)
    OR (delivery_scope = 'platform' AND tenant_id IS NULL)
  );

CREATE UNIQUE INDEX uq_platform_integration_delivery_jobs_idempotency
  ON integration_delivery_jobs (provider, capability, domain_event_id)
  WHERE delivery_scope = 'platform';

CREATE TABLE platform_sms_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_job_id UUID NOT NULL REFERENCES integration_delivery_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  provider TEXT NOT NULL,
  purpose TEXT NOT NULL,
  template_key TEXT,
  recipient_hash TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_platform_sms_usage_delivery_attempt UNIQUE (delivery_job_id, attempt_number),
  CONSTRAINT platform_sms_usage_attempt_check CHECK (attempt_number > 0),
  CONSTRAINT platform_sms_usage_provider_check CHECK (provider = 'melipayamak'),
  CONSTRAINT platform_sms_usage_purpose_check CHECK (purpose = 'platform_ops_login'),
  CONSTRAINT platform_sms_usage_status_check CHECK (status IN ('attempted', 'sent', 'failed', 'unknown'))
);

CREATE INDEX idx_platform_sms_usage_purpose_created
  ON platform_sms_usage_events (purpose, created_at DESC);

ALTER TABLE platform_sms_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_sms_usage_events FORCE ROW LEVEL SECURITY;

-- This ledger is intentionally platform-only. Tenant-scoped app roles have no access.
REVOKE ALL ON TABLE platform_sms_usage_events FROM PUBLIC, app_tour;
