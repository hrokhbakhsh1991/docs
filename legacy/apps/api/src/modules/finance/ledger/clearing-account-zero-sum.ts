import { LEDGER_ACCOUNTS } from "./ledger-accounts";
import { normalizeFinanceTenantId } from "./ledger-tenant-scope";
import type { LedgerJournalLine } from "./ledger-journal-line";

export type ClearingZeroSumViolation = {
  currency: string;
  netMinor: string;
  source: "ledger_lines" | "account_balances";
};

/**
 * Signed net on the leader clearing GL account from journal lines (credits +, debits −).
 * In a closed tenant batch, every currency bucket should net to exactly zero.
 */
export function netClearingMinorByCurrencyFromLines(
  tenantId: string,
  ledgerLines: readonly LedgerJournalLine[],
  clearingAccount: string = LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING
): Map<string, bigint> {
  const tid = normalizeFinanceTenantId(tenantId);
  const net = new Map<string, bigint>();
  for (const line of ledgerLines) {
    if (normalizeFinanceTenantId(line.tenantId) !== tid || line.account !== clearingAccount) {
      continue;
    }
    const amount = BigInt(line.amount_minor);
    const delta = line.side === "credit" ? amount : -amount;
    const cur = line.currency.trim() || "UNK";
    net.set(cur, (net.get(cur) ?? 0n) + delta);
  }
  return net;
}

export function findClearingZeroSumViolationsFromLines(
  tenantId: string,
  ledgerLines: readonly LedgerJournalLine[]
): ClearingZeroSumViolation[] {
  const violations: ClearingZeroSumViolation[] = [];
  for (const [currency, net] of netClearingMinorByCurrencyFromLines(tenantId, ledgerLines)) {
    if (net !== 0n) {
      violations.push({
        currency,
        netMinor: net.toString(),
        source: "ledger_lines"
      });
    }
  }
  return violations;
}

/** Validates persisted `account_balances` rows for the clearing account (per currency). */
export function findClearingZeroSumViolationsFromBalances(
  clearingBalances: ReadonlyArray<{ currency: string; balanceMinor: string }>
): ClearingZeroSumViolation[] {
  const violations: ClearingZeroSumViolation[] = [];
  for (const row of clearingBalances) {
    const bal = BigInt(row.balanceMinor.trim() || "0");
    if (bal !== 0n) {
      violations.push({
        currency: row.currency.trim() || "UNK",
        netMinor: bal.toString(),
        source: "account_balances"
      });
    }
  }
  return violations;
}
