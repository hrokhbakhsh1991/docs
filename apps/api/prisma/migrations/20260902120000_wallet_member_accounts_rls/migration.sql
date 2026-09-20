-- WALLET-P2C — member wallet tables + tenant RLS + append-only ledger enforcement

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  currency VARCHAR(8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallet_accounts_tenant_workspace_user_currency_key
    UNIQUE (tenant_id, workspace_id, user_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_tenant_workspace_user
  ON wallet_accounts (tenant_id, workspace_id, user_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_minor TEXT NOT NULL,
  currency VARCHAR(8) NOT NULL,
  creation_idempotency_key TEXT NOT NULL,
  command_fingerprint TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  actor_user_id UUID NOT NULL,
  actor_role TEXT NOT NULL,
  reverses_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE RESTRICT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallet_transactions_tenant_creation_idempotency_key
    UNIQUE (tenant_id, creation_idempotency_key),
  CONSTRAINT wallet_transactions_no_self_reversal
    CHECK (reverses_transaction_id IS NULL OR reverses_transaction_id <> id),
  CONSTRAINT wallet_transactions_amount_minor_positive
    CHECK (amount_minor ~ '^[1-9][0-9]*$')
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tenant_account
  ON wallet_transactions (tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tenant_account_status
  ON wallet_transactions (tenant_id, account_id, status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tenant_reverses
  ON wallet_transactions (tenant_id, reverses_transaction_id);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_one_posted_reversal_per_original
  ON wallet_transactions (tenant_id, reverses_transaction_id)
  WHERE reverses_transaction_id IS NOT NULL AND status = 'posted';

CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES wallet_transactions(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL,
  amount_minor TEXT NOT NULL,
  currency VARCHAR(8) NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallet_ledger_entries_direction_check
    CHECK (direction IN ('credit', 'debit')),
  CONSTRAINT wallet_ledger_entries_amount_minor_positive
    CHECK (amount_minor ~ '^[1-9][0-9]*$')
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_entries_tenant_account
  ON wallet_ledger_entries (tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_entries_tenant_transaction
  ON wallet_ledger_entries (tenant_id, transaction_id);

-- Tenant RLS (ENABLE + FORCE)
ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_accounts_tenant_isolation ON wallet_accounts;
CREATE POLICY wallet_accounts_tenant_isolation ON wallet_accounts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_transactions_tenant_isolation ON wallet_transactions;
CREATE POLICY wallet_transactions_tenant_isolation ON wallet_transactions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE wallet_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_ledger_entries_tenant_isolation ON wallet_ledger_entries;
CREATE POLICY wallet_ledger_entries_tenant_isolation ON wallet_ledger_entries
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Append-only ledger entries (corrections via compensating entries only)
CREATE OR REPLACE FUNCTION reject_wallet_ledger_entries_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'wallet_ledger_entries is append-only';
END;
$$;

DROP TRIGGER IF EXISTS wallet_ledger_entries_append_only ON wallet_ledger_entries;
CREATE TRIGGER wallet_ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON wallet_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION reject_wallet_ledger_entries_mutation();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wallet_accounts TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wallet_transactions TO app_tour;
GRANT SELECT, INSERT ON TABLE wallet_ledger_entries TO app_tour;
