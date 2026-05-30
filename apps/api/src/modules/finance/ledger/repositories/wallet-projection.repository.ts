import type { EntityManager } from "typeorm";
import { AccountBalanceEntity } from "../entities/account-balance.entity";
import { normalizeFinanceTenantId } from "../ledger-tenant-scope";
import type { WalletProjection } from "../wallet-projection";

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
    where: { tenantId: tenantNorm, account: ledgerAccount, currency: currencyNorm },
  });

  if (!row) {
    return {
      tenantId: tenantNorm,
      ledgerAccount,
      balance_minor: "0",
      currency: "",
      asOfLineId: null,
      asOfCreatedAt: null,
      entryCount: 0,
    };
  }

  return {
    tenantId: tenantNorm,
    ledgerAccount,
    balance_minor: row.balanceMinor,
    currency: row.currency,
    asOfLineId: null,
    asOfCreatedAt: row.updatedAt.toISOString(),
    entryCount: -1,
  };
}
