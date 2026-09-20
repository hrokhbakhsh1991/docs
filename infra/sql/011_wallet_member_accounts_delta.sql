-- WALLET-P2C — member wallet tables reference (Prisma migration is authoritative)
-- @see apps/api/prisma/migrations/20260902120000_wallet_member_accounts_rls/migration.sql

-- Tables: wallet_accounts, wallet_transactions, wallet_ledger_entries
-- RLS: ENABLE + FORCE tenant_id = current_setting('app.current_tenant_id', true)::uuid
-- Ledger: append-only trigger on wallet_ledger_entries (no UPDATE/DELETE for app_tour)
-- Balance: derived from posted ledger entries only — no balance column on wallet_accounts
-- Idempotency: UNIQUE (tenant_id, creation_idempotency_key) on wallet_transactions
-- Reversal: partial UNIQUE (tenant_id, reverses_transaction_id) WHERE status = 'posted'
