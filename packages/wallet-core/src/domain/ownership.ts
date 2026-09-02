import { walletErr, walletOk, type WalletResult } from "./errors";
import type { WalletAccount, WalletLedgerEntry, WalletTransaction } from "./types";

export type WalletOwnershipScope = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId?: string;
};

export function assertAccountOwnership(
  account: WalletAccount,
  scope: WalletOwnershipScope,
): WalletResult<void> {
  if (account.tenantId !== scope.tenantId) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "account tenantId does not match command scope",
    );
  }
  if (account.workspaceId !== scope.workspaceId) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "account workspaceId does not match command scope",
    );
  }
  if (scope.userId !== undefined && account.userId !== scope.userId) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "account userId does not match command scope",
    );
  }
  return walletOk(undefined);
}

export function assertAccountActive(account: WalletAccount): WalletResult<void> {
  if (account.status !== "active") {
    return walletErr(
      "WALLET_ACCOUNT_NOT_ACTIVE",
      `wallet account status is ${account.status}`,
    );
  }
  return walletOk(undefined);
}

export function assertLedgerEntryBelongsToAccount(
  entry: WalletLedgerEntry,
  account: WalletAccount,
): WalletResult<void> {
  if (entry.accountId !== account.id) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "ledger entry accountId does not match wallet account",
    );
  }
  if (entry.tenantId !== account.tenantId) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "ledger entry tenantId does not match wallet account",
    );
  }
  if (entry.currency !== account.currency) {
    return walletErr(
      "WALLET_CURRENCY_MISMATCH",
      "ledger entry currency does not match wallet account",
    );
  }
  return walletOk(undefined);
}

export function assertTransactionBelongsToAccount(
  transaction: WalletTransaction,
  account: WalletAccount,
): WalletResult<void> {
  if (transaction.accountId !== account.id) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "transaction accountId does not match wallet account",
    );
  }
  if (transaction.tenantId !== account.tenantId) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "transaction tenantId does not match wallet account",
    );
  }
  if (transaction.workspaceId !== account.workspaceId) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "transaction workspaceId does not match wallet account",
    );
  }
  if (transaction.currency !== account.currency) {
    return walletErr(
      "WALLET_CURRENCY_MISMATCH",
      "transaction currency does not match wallet account",
    );
  }
  return walletOk(undefined);
}

export function assertEntriesBelongToTransaction(
  transaction: WalletTransaction,
  entries: readonly WalletLedgerEntry[],
): WalletResult<void> {
  for (const entry of entries) {
    if (entry.transactionId !== transaction.id) {
      return walletErr(
        "WALLET_OWNERSHIP_MISMATCH",
        "ledger entry transactionId does not match transaction",
      );
    }
    if (entry.accountId !== transaction.accountId) {
      return walletErr(
        "WALLET_OWNERSHIP_MISMATCH",
        "cross-account ledger entry rejected",
      );
    }
    if (entry.tenantId !== transaction.tenantId) {
      return walletErr(
        "WALLET_OWNERSHIP_MISMATCH",
        "ledger entry tenantId does not match transaction",
      );
    }
    if (entry.currency !== transaction.currency) {
      return walletErr(
        "WALLET_CURRENCY_MISMATCH",
        "ledger entry currency does not match transaction",
      );
    }
  }
  return walletOk(undefined);
}
