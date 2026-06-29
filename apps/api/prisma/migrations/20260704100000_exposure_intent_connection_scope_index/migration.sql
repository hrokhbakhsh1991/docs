-- Phase 9.3 — index connection-scoped exposure intent lookups (listForConnectionScope).
CREATE INDEX IF NOT EXISTS idx_exposure_intents_tenant_connection_scope
  ON exposure_intents (tenant_id, ((scope->>'connectionId')));
