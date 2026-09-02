/**
 * WALLET-P2C — Prisma row ↔ wallet-core domain mappers (host adapter only).
 */
import type {
  WalletAccount as PrismaWalletAccount,
  WalletLedgerEntry as PrismaWalletLedgerEntry,
  WalletTransaction as PrismaWalletTransaction,
} from "@prisma/client";

import type {
  LedgerDirection,
  WalletAccount,
  WalletAccountStatus,
  WalletActorRole,
  WalletLedgerEntry,
  WalletMutationResult,
  WalletTransaction,
  WalletTransactionKind,
  WalletTransactionStatus,
} from "@app-tour/wallet-core";

export function mapWalletAccount(row: PrismaWalletAccount): WalletAccount {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    userId: row.userId,
    status: row.status as WalletAccountStatus,
    currency: row.currency,
  };
}

export function mapWalletTransaction(row: PrismaWalletTransaction): WalletTransaction {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    accountId: row.accountId,
    kind: row.kind as WalletTransactionKind,
    status: row.status as WalletTransactionStatus,
    amountMinor: row.amountMinor,
    currency: row.currency,
    creationIdempotencyKey: row.creationIdempotencyKey,
    reference:
      row.referenceType !== null && row.referenceId !== null
        ? { type: row.referenceType, id: row.referenceId }
        : null,
    actor: {
      actorUserId: row.actorUserId,
      actorRole: row.actorRole as WalletActorRole,
    },
    reversesTransactionId: row.reversesTransactionId,
    createdAt: row.createdAt.toISOString(),
    postedAt: row.postedAt?.toISOString() ?? null,
  };
}

export function mapWalletLedgerEntry(row: PrismaWalletLedgerEntry): WalletLedgerEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    transactionId: row.transactionId,
    accountId: row.accountId,
    direction: row.direction as LedgerDirection,
    amountMinor: row.amountMinor,
    currency: row.currency,
    postedAt: row.postedAt.toISOString(),
  };
}

export function mapWalletMutation(
  transaction: PrismaWalletTransaction,
  ledgerEntries: readonly PrismaWalletLedgerEntry[],
): WalletMutationResult {
  return {
    transaction: mapWalletTransaction(transaction),
    ledgerEntries: ledgerEntries.map(mapWalletLedgerEntry),
  };
}
