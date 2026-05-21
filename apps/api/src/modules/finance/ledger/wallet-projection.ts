import type { EntityManager } from "typeorm";
import { AccountBalanceEntity } from "./entities/account-balance.entity";
import { normalizeFinanceTenantId } from "./ledger-tenant-scope";
import type { LedgerJournalLine } from "./ledger-journal-line";

/**
 * Read model snapshot for a wallet — authoritative when loaded via {@link calculateWalletBalance}.
 */
export type WalletProjection = {
  tenantId: string;
  /** Ledger account id (same convention as `LedgerJournalLine.account`). */
  ledgerAccount: string;
  /** Sum of signed `amount_minor` for included rows (minor units): credits +, debits −. */
  balance_minor: string;
  currency: string;
  asOfLineId: string | null;
  asOfCreatedAt: string | null;
  entryCount: number;
};

/**
 * Authoritative wallet balance: single-row read from `account_balances`.
 */
export async function calculateWalletBalance(
  manager: EntityManager,
  tenantId: string,
  ledgerAccount: string,
  currency: string
): Promise<WalletProjection> {
  const tenantNorm = normalizeFinanceTenantId(tenantId);
  const currencyNorm = currency.trim() || "UNK";
  const row = await manager.findOne(AccountBalanceEntity, {
    where: { tenantId: tenantNorm, account: ledgerAccount, currency: currencyNorm }
  });

  if (!row) {
    return {
      tenantId: tenantNorm,
      ledgerAccount,
      balance_minor: "0",
      currency: "",
      asOfLineId: null,
      asOfCreatedAt: null,
      entryCount: 0
    };
  }

  return {
    tenantId: tenantNorm,
    ledgerAccount,
    balance_minor: row.balanceMinor,
    currency: row.currency,
    asOfLineId: null,
    asOfCreatedAt: row.updatedAt.toISOString(),
    entryCount: -1
  };
}

/**
 * Derived balance from an in-memory line slice (non-authoritative; invoices / legacy tests).
 */
export function sumWalletBalanceFromLedgerLines(
  tenantId: string,
  ledgerAccount: string,
  lines: LedgerJournalLine[]
): WalletProjection {
  const tenantNorm = normalizeFinanceTenantId(tenantId);
  for (const line of lines) {
    if (normalizeFinanceTenantId(line.tenantId) !== tenantNorm) {
      throw new Error(
        `FINANCE_WALLET_TENANT_SCOPE: ledger line ${line.id} tenant_id does not match projection tenant_id (refuse cross-tenant aggregation)`
      );
    }
  }
  const scoped = lines
    .filter((x) => x.account === ledgerAccount)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  if (scoped.length === 0) {
    return {
      tenantId: tenantNorm,
      ledgerAccount,
      balance_minor: "0",
      currency: "",
      asOfLineId: null,
      asOfCreatedAt: null,
      entryCount: 0
    };
  }
  let balance = 0n;
  for (const line of scoped) {
    const a = BigInt(line.amount_minor);
    balance += line.side === "credit" ? a : -a;
  }
  const last = scoped[scoped.length - 1]!;
  return {
    tenantId: tenantNorm,
    ledgerAccount,
    balance_minor: balance.toString(),
    currency: last.currency,
    asOfLineId: last.id,
    asOfCreatedAt: last.createdAt,
    entryCount: scoped.length
  };
}
