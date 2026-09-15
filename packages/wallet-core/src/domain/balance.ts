import { walletErr, walletOk, type WalletResult } from "./errors";
import { validateAmountMinor } from "./money";
import {
  assertAccountOwnership,
  assertLedgerEntryBelongsToAccount,
} from "./ownership";
import type {
  LedgerDirection,
  WalletAccount,
  WalletBalance,
  WalletLedgerEntry,
  WalletTransaction,
  WalletTransactionStatus,
} from "./types";

const BALANCE_AFFECTING_STATUSES = new Set<WalletTransactionStatus>(["posted"]);

/**
 * Derive wallet balance from posted ledger entries only.
 * Failed/cancelled transactions must not contribute entries to this set.
 */
export function calculateBalance(
  account: WalletAccount,
  entries: readonly WalletLedgerEntry[],
): WalletResult<WalletBalance> {
  let total = BigInt(0);

  for (const entry of entries) {
    const belongs = assertLedgerEntryBelongsToAccount(entry, account);
    if (!belongs.ok) {
      return belongs;
    }

    const amountResult = validateAmountMinor(entry.amountMinor);
    if (!amountResult.ok) {
      return amountResult;
    }

    const amount = BigInt(entry.amountMinor);
    if (entry.direction === "credit") {
      total += amount;
    } else {
      total -= amount;
    }
  }

  return walletOk({
    accountId: account.id,
    currency: account.currency,
    balanceMinor: total.toString(),
  });
}

export function assertTransactionNotPosted(
  transaction: WalletTransaction,
): WalletResult<void> {
  if (transaction.status === "posted") {
    return walletErr(
      "WALLET_TRANSACTION_ALREADY_POSTED",
      `transaction ${transaction.id} is already posted`,
    );
  }
  return walletOk(undefined);
}

export function assertTransactionIsPosted(
  transaction: WalletTransaction,
): WalletResult<void> {
  if (!BALANCE_AFFECTING_STATUSES.has(transaction.status)) {
    return walletErr(
      "WALLET_REVERSAL_INVALID",
      `transaction ${transaction.id} is not posted`,
    );
  }
  return walletOk(undefined);
}

export function oppositeDirection(direction: LedgerDirection): LedgerDirection {
  return direction === "credit" ? "debit" : "credit";
}

export function directionForKind(
  kind: "operator_credit" | "operator_debit",
): LedgerDirection {
  return kind === "operator_credit" ? "credit" : "debit";
}

export function assertSufficientFunds(
  currentBalanceMinor: string,
  debitAmountMinor: string,
): WalletResult<void> {
  const balance = BigInt(currentBalanceMinor);
  const debit = BigInt(debitAmountMinor);
  if (balance < debit) {
    return walletErr(
      "WALLET_INSUFFICIENT_FUNDS",
      "debit would make wallet balance negative",
    );
  }
  return walletOk(undefined);
}

export function assertAccountScope(
  account: WalletAccount,
  tenantId: string,
  workspaceId: string,
  userId: string,
): WalletResult<void> {
  return assertAccountOwnership(account, { tenantId, workspaceId, userId });
}
