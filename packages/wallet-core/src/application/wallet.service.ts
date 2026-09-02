import {
  assertAccountActive,
  assertAccountOwnership,
  assertEntriesBelongToTransaction,
  assertLedgerEntryBelongsToAccount,
  assertTransactionBelongsToAccount,
} from "../domain/ownership";
import {
  assertCurrencyMatch,
  normalizeCurrency,
  validateAmountMinor,
} from "../domain/money";
import {
  assertSufficientFunds,
  assertTransactionIsPosted,
  calculateBalance,
  directionForKind,
  oppositeDirection,
} from "../domain/balance";
import { walletErr, walletOk, type WalletResult } from "../domain/errors";
import type {
  WalletAccount,
  WalletHistoryItem,
  WalletHistoryPage,
  WalletLedgerEntry,
  WalletTransaction,
} from "../domain/types";
import type {
  OperatorCreditCommand,
  OperatorDebitCommand,
  ReversalCommand,
  WalletMutationResult,
} from "./commands";

function buildPostedTransaction(
  input: {
    readonly id: string;
    readonly tenantId: string;
    readonly workspaceId: string;
    readonly accountId: string;
    readonly kind: WalletTransaction["kind"];
    readonly amountMinor: string;
    readonly currency: string;
    readonly creationIdempotencyKey: string | null;
    readonly reference: WalletTransaction["reference"];
    readonly actor: WalletTransaction["actor"];
    readonly reversesTransactionId: string | null;
    readonly nowIso: string;
  },
): WalletTransaction {
  return {
    id: input.id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    kind: input.kind,
    status: "posted",
    amountMinor: input.amountMinor,
    currency: input.currency,
    creationIdempotencyKey: input.creationIdempotencyKey,
    reference: input.reference,
    actor: input.actor,
    reversesTransactionId: input.reversesTransactionId,
    createdAt: input.nowIso,
    postedAt: input.nowIso,
  };
}

function buildPostedLedgerEntry(input: {
  readonly id: string;
  readonly tenantId: string;
  readonly transactionId: string;
  readonly accountId: string;
  readonly direction: WalletLedgerEntry["direction"];
  readonly amountMinor: string;
  readonly currency: string;
  readonly postedAt: string;
}): WalletLedgerEntry {
  return {
    id: input.id,
    tenantId: input.tenantId,
    transactionId: input.transactionId,
    accountId: input.accountId,
    direction: input.direction,
    amountMinor: input.amountMinor,
    currency: input.currency,
    postedAt: input.postedAt,
  };
}

function validateMutationCommand(
  account: WalletAccount,
  command: {
    readonly tenantId: string;
    readonly workspaceId: string;
    readonly userId: string;
    readonly accountId: string;
    readonly amountMinor: string;
    readonly currency: string;
  },
): WalletResult<{ amountMinor: string; currency: string }> {
  if (command.accountId !== account.id) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "command accountId does not match wallet account",
    );
  }

  const active = assertAccountActive(account);
  if (!active.ok) {
    return active;
  }

  const ownership = assertAccountOwnership(account, {
    tenantId: command.tenantId,
    workspaceId: command.workspaceId,
    userId: command.userId,
  });
  if (!ownership.ok) {
    return ownership;
  }

  const amountResult = validateAmountMinor(command.amountMinor);
  if (!amountResult.ok) {
    return amountResult;
  }

  const currencyResult = normalizeCurrency(command.currency);
  if (!currencyResult.ok) {
    return currencyResult;
  }

  const match = assertCurrencyMatch(currencyResult.value, account.currency);
  if (!match.ok) {
    return match;
  }

  return walletOk({
    amountMinor: amountResult.value,
    currency: currencyResult.value,
  });
}

export function createOperatorCredit(
  account: WalletAccount,
  command: OperatorCreditCommand,
): WalletResult<WalletMutationResult> {
  const validated = validateMutationCommand(account, command);
  if (!validated.ok) {
    return validated;
  }

  const transaction = buildPostedTransaction({
    id: command.transactionId,
    tenantId: command.tenantId,
    workspaceId: command.workspaceId,
    accountId: command.accountId,
    kind: "operator_credit",
    amountMinor: validated.value.amountMinor,
    currency: validated.value.currency,
    creationIdempotencyKey: command.creationIdempotencyKey,
    reference: command.reference,
    actor: command.actor,
    reversesTransactionId: null,
    nowIso: command.nowIso,
  });

  const ledgerEntry = buildPostedLedgerEntry({
    id: command.ledgerEntryId,
    tenantId: command.tenantId,
    transactionId: transaction.id,
    accountId: command.accountId,
    direction: directionForKind("operator_credit"),
    amountMinor: validated.value.amountMinor,
    currency: validated.value.currency,
    postedAt: command.nowIso,
  });

  return walletOk({
    transaction,
    ledgerEntries: [ledgerEntry],
  });
}

export function createOperatorDebit(
  account: WalletAccount,
  command: OperatorDebitCommand,
  currentEntries: readonly WalletLedgerEntry[],
): WalletResult<WalletMutationResult> {
  const validated = validateMutationCommand(account, command);
  if (!validated.ok) {
    return validated;
  }

  const balanceResult = calculateBalance(account, currentEntries);
  if (!balanceResult.ok) {
    return balanceResult;
  }

  const funds = assertSufficientFunds(
    balanceResult.value.balanceMinor,
    validated.value.amountMinor,
  );
  if (!funds.ok) {
    return funds;
  }

  const transaction = buildPostedTransaction({
    id: command.transactionId,
    tenantId: command.tenantId,
    workspaceId: command.workspaceId,
    accountId: command.accountId,
    kind: "operator_debit",
    amountMinor: validated.value.amountMinor,
    currency: validated.value.currency,
    creationIdempotencyKey: command.creationIdempotencyKey,
    reference: command.reference,
    actor: command.actor,
    reversesTransactionId: null,
    nowIso: command.nowIso,
  });

  const ledgerEntry = buildPostedLedgerEntry({
    id: command.ledgerEntryId,
    tenantId: command.tenantId,
    transactionId: transaction.id,
    accountId: command.accountId,
    direction: directionForKind("operator_debit"),
    amountMinor: validated.value.amountMinor,
    currency: validated.value.currency,
    postedAt: command.nowIso,
  });

  return walletOk({
    transaction,
    ledgerEntries: [ledgerEntry],
  });
}

export function createReversal(
  account: WalletAccount,
  command: ReversalCommand,
  originalTransaction: WalletTransaction,
  originalEntries: readonly WalletLedgerEntry[],
  existingReversal: WalletTransaction | null,
): WalletResult<WalletMutationResult> {
  if (command.reversalTransactionId === command.originalTransactionId) {
    return walletErr(
      "WALLET_REVERSAL_INVALID",
      "reversal cannot reference itself",
    );
  }

  if (command.accountId !== account.id) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "command accountId does not match wallet account",
    );
  }

  const active = assertAccountActive(account);
  if (!active.ok) {
    return active;
  }

  const ownership = assertAccountOwnership(account, {
    tenantId: command.tenantId,
    workspaceId: command.workspaceId,
    userId: command.userId,
  });
  if (!ownership.ok) {
    return ownership;
  }

  if (originalTransaction.id !== command.originalTransactionId) {
    return walletErr(
      "WALLET_REVERSAL_INVALID",
      "original transaction id mismatch",
    );
  }

  const belongs = assertTransactionBelongsToAccount(originalTransaction, account);
  if (!belongs.ok) {
    return belongs;
  }

  const posted = assertTransactionIsPosted(originalTransaction);
  if (!posted.ok) {
    return posted;
  }

  if (originalTransaction.kind === "reversal") {
    return walletErr(
      "WALLET_REVERSAL_INVALID",
      "cannot reverse a reversal transaction",
    );
  }

  const entryLink = assertEntriesBelongToTransaction(
    originalTransaction,
    originalEntries,
  );
  if (!entryLink.ok) {
    return entryLink;
  }

  if (originalEntries.length === 0) {
    return walletErr(
      "WALLET_REVERSAL_INVALID",
      "original transaction has no ledger entries",
    );
  }

  if (
    existingReversal &&
    existingReversal.reversesTransactionId === originalTransaction.id &&
    existingReversal.status === "posted"
  ) {
    return walletErr(
      "WALLET_REVERSAL_INVALID",
      "original transaction already reversed",
    );
  }

  const compensatingEntries: WalletLedgerEntry[] = [];
  for (const originalEntry of originalEntries) {
    const amountResult = validateAmountMinor(originalEntry.amountMinor);
    if (!amountResult.ok) {
      return amountResult;
    }

    compensatingEntries.push(
      buildPostedLedgerEntry({
        id:
          originalEntries.length === 1
            ? command.reversalLedgerEntryId
            : `${command.reversalLedgerEntryId}:${originalEntry.id}`,
        tenantId: command.tenantId,
        transactionId: command.reversalTransactionId,
        accountId: command.accountId,
        direction: oppositeDirection(originalEntry.direction),
        amountMinor: amountResult.value,
        currency: originalEntry.currency,
        postedAt: command.nowIso,
      }),
    );
  }

  const reversalAmountMinor = originalTransaction.amountMinor;
  const transaction = buildPostedTransaction({
    id: command.reversalTransactionId,
    tenantId: command.tenantId,
    workspaceId: command.workspaceId,
    accountId: command.accountId,
    kind: "reversal",
    amountMinor: reversalAmountMinor,
    currency: originalTransaction.currency,
    creationIdempotencyKey: command.creationIdempotencyKey,
    reference: command.reference,
    actor: command.actor,
    reversesTransactionId: originalTransaction.id,
    nowIso: command.nowIso,
  });

  return walletOk({
    transaction,
    ledgerEntries: compensatingEntries,
  });
}

export function buildMemberBalanceView(
  account: WalletAccount,
  entries: readonly WalletLedgerEntry[],
): WalletResult<import("../domain/types").WalletBalance> {
  return calculateBalance(account, entries);
}

export function buildMemberTransactionHistory(
  account: WalletAccount,
  transactions: readonly WalletTransaction[],
  entries: readonly WalletLedgerEntry[],
): WalletResult<WalletHistoryPage> {
  const entriesByTransaction = new Map<string, WalletLedgerEntry[]>();

  for (const entry of entries) {
    const belongs = assertLedgerEntryBelongsToAccount(entry, account);
    if (!belongs.ok) {
      return belongs;
    }

    const bucket = entriesByTransaction.get(entry.transactionId) ?? [];
    bucket.push(entry);
    entriesByTransaction.set(entry.transactionId, bucket);
  }

  const items: WalletHistoryItem[] = [];
  for (const transaction of transactions) {
    const belongs = assertTransactionBelongsToAccount(transaction, account);
    if (!belongs.ok) {
      return belongs;
    }

    const ledgerEntries = entriesByTransaction.get(transaction.id) ?? [];
    if (transaction.status === "posted" && ledgerEntries.length === 0) {
      return walletErr(
        "WALLET_REVERSAL_INVALID",
        "posted transaction missing ledger entries in history view",
      );
    }

    if (transaction.status !== "posted") {
      continue;
    }

    items.push({ transaction, ledgerEntries });
  }

  return walletOk({
    accountId: account.id,
    currency: account.currency,
    items,
  });
}
