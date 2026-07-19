-- Phase 3.19 — recon repair engine audit columns
ALTER TABLE finance_recon_actions
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'preview',
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS rollback_strategy TEXT NOT NULL DEFAULT 'ticket_only';

COMMENT ON COLUMN finance_recon_actions.mode IS 'preview|manual|approved|automatic';
COMMENT ON COLUMN finance_recon_actions.rollback_strategy IS 'Declared rollback strategy from repair matrix';
