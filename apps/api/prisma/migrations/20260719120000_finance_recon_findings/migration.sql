-- Finance reconciliation foundation — findings + append-only repair audit
-- Admin/ops owned; no approve TX / ledger ID changes.

CREATE TABLE IF NOT EXISTS finance_recon_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  fingerprint TEXT NOT NULL,
  payment_id UUID,
  registration_id UUID,
  outbox_event_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  CONSTRAINT finance_recon_findings_status_chk
    CHECK (status IN ('open', 'resolved', 'ignored')),
  CONSTRAINT finance_recon_findings_tenant_code_fp_key
    UNIQUE (tenant_id, code, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_finance_recon_findings_open
  ON finance_recon_findings (status, detected_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_finance_recon_findings_tenant_status
  ON finance_recon_findings (tenant_id, status, code);

CREATE TABLE IF NOT EXISTS finance_recon_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES finance_recon_findings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  action TEXT NOT NULL,
  actor_user_id TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  result TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_recon_actions_finding
  ON finance_recon_actions (finding_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_finance_recon_actions_tenant
  ON finance_recon_actions (tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE finance_recon_findings TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE finance_recon_actions TO app_tour;
