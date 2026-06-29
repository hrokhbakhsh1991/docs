-- Idempotent Denali relative-time reminder activations (multi-surface exposure Phase Denali).
CREATE TABLE IF NOT EXISTS denali_exposure_reminder_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL,
  reminder_offset TEXT NOT NULL,
  anchor_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_denali_exposure_reminder_activations_idempotency
  ON denali_exposure_reminder_activations (tenant_id, tour_id, reminder_offset);

CREATE INDEX IF NOT EXISTS idx_denali_exposure_reminder_activations_tenant_activated
  ON denali_exposure_reminder_activations (tenant_id, activated_at DESC);
