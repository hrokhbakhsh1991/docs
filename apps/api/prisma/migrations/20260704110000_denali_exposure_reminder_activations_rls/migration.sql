-- Phase 9.3 — tenant RLS for Denali reminder activation ledger (parity with exposure_intents).
ALTER TABLE denali_exposure_reminder_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE denali_exposure_reminder_activations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS denali_exposure_reminder_activations_tenant_isolation
  ON denali_exposure_reminder_activations;
CREATE POLICY denali_exposure_reminder_activations_tenant_isolation
  ON denali_exposure_reminder_activations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE denali_exposure_reminder_activations TO app_tour;
