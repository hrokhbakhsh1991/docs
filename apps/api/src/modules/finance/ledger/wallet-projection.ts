import { normalizeFinanceTenantId } from "./ledger-tenant-scope";
import type { LedgerJournalLine } from "./ledger-journal-line";

/**
 * **Read model** snapshot for a wallet — derived from append-only facts, never authoritative storage.
 * Production balances may come from materialized views, projections, or cached aggregates.
 *
 * TODO: Reconciliation vs PSP settlement files and internal `payments` rows.
 * TODO: Settlement windows / batched payout entries.
 * TODO: Credit expiration policy and scheduled ledger rows.
 */
export type WalletProjection = {
  tenantId: string;
  /** Ledger account id (same convention as `LedgerJournalLine.account`). */
  ledgerAccount: string;
  /** Sum of signed `amount_minor` for included rows (minor units): credits +, debits −. */
  balance_minor: string;
  currency: string;
  /** Monotonic cursor for incremental projection rebuilds (e.g. last `createdAt` / last `id`). */
  asOfLineId: string | null;
  asOfCreatedAt: string | null;
  entryCount: number;
};

/**
 * **Placeholder** wallet balance from an in-memory slice of ledger lines.
 * Replace with SQL aggregation `GROUP BY tenant_id, account` or stream processor in production.
 *
 * **Tenant isolation:** throws `FINANCE_WALLET_TENANT_SCOPE` if `lines` contains any row whose
 * `tenantId` does not match the requested scope (no silent dropping of foreign-tenant rows).
 *
 * @param ledgerAccount — typically {@link bookingWalletId} or another `LedgerJournalLine.account`.
 */
export function calculateWalletBalance(
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
  const currency = last.currency;
  return {
    tenantId: tenantNorm,
    ledgerAccount,
    balance_minor: balance.toString(),
    currency,
    asOfLineId: last.id,
    asOfCreatedAt: last.createdAt,
    entryCount: scoped.length
  };
}
