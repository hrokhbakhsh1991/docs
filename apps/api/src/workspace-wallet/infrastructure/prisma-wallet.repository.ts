/**
 * WALLET-P2C — Prisma + tenant RLS wallet persistence (host adapter).
 *
 * All mutations delegate to wallet-core domain services; this layer only maps/persists.
 */
import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import {
  buildMemberBalanceView,
  buildMemberTransactionHistory,
  createOperatorCredit,
  createOperatorDebit,
  createReversal,
  normalizeCurrency,
  operatorCreditFingerprint,
  operatorDebitFingerprint,
  resolveIdempotencyReplay,
  reversalFingerprint,
  walletErr,
  walletOk,
  type WalletAccount,
  type WalletBalance,
  type WalletHistoryPage,
  type WalletLedgerEntry,
  type WalletMutationResult,
  type WalletResult,
  type WalletTransaction,
} from "@app-tour/wallet-core";

import { withTenantRls } from "../../db/with-tenant-rls";
import { appendWalletMutationAudit } from "../wallet-audit-writer";
import type {
  FindMemberWalletAccountQuery,
  GetOrCreateWalletAccountInput,
  WalletMemberScope,
  WalletMemberTransactionsQuery,
  WalletOperatorAccountLookupQuery,
  WalletOperatorCreditInput,
  WalletOperatorDebitInput,
  WalletReversalInput,
} from "../wallet-repository.types";
import { advisoryLockWalletAccount } from "./wallet-account-advisory-lock";
import {
  mapWalletAccount,
  mapWalletLedgerEntry,
  mapWalletTransaction,
} from "./wallet-prisma-mappers";

async function loadAccount(
  tx: Prisma.TransactionClient,
  tenantId: string,
  accountId: string,
): Promise<WalletAccount | null> {
  const row = await tx.walletAccount.findFirst({
    where: { id: accountId, tenantId },
  });
  return row === null ? null : mapWalletAccount(row);
}

async function loadLedgerEntriesForAccount(
  tx: Prisma.TransactionClient,
  tenantId: string,
  accountId: string,
): Promise<readonly WalletLedgerEntry[]> {
  const rows = await tx.walletLedgerEntry.findMany({
    where: { tenantId, accountId },
    orderBy: { postedAt: "asc" },
  });
  return rows.map(mapWalletLedgerEntry);
}

async function loadMutationByIdempotencyKey(
  tx: Prisma.TransactionClient,
  tenantId: string,
  creationIdempotencyKey: string,
): Promise<{
  transaction: WalletTransaction;
  ledgerEntries: readonly WalletLedgerEntry[];
  commandFingerprint: string;
} | null> {
  const row = await tx.walletTransaction.findUnique({
    where: {
      tenantId_creationIdempotencyKey: { tenantId, creationIdempotencyKey },
    },
    include: { ledgerEntries: true },
  });
  if (row === null) {
    return null;
  }
  return {
    transaction: mapWalletTransaction(row),
    ledgerEntries: row.ledgerEntries.map(mapWalletLedgerEntry),
    commandFingerprint: row.commandFingerprint,
  };
}

function assertMemberScope(
  account: WalletAccount,
  scope: WalletMemberScope,
): WalletResult<void> {
  if (account.tenantId !== scope.tenantId) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "account tenantId does not match member scope",
    );
  }
  if (account.workspaceId !== scope.workspaceId) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "account workspaceId does not match member scope",
    );
  }
  if (account.userId !== scope.userId) {
    return walletErr(
      "WALLET_OWNERSHIP_MISMATCH",
      "account userId does not match member scope",
    );
  }
  return walletOk(undefined);
}

async function persistMutation(
  tx: Prisma.TransactionClient,
  mutation: WalletMutationResult,
  commandFingerprint: string,
): Promise<void> {
  const transaction = mutation.transaction;
  await tx.walletTransaction.create({
    data: {
      id: transaction.id,
      tenantId: transaction.tenantId,
      workspaceId: transaction.workspaceId,
      accountId: transaction.accountId,
      kind: transaction.kind,
      status: transaction.status,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      creationIdempotencyKey: transaction.creationIdempotencyKey ?? "",
      commandFingerprint,
      referenceType: transaction.reference?.type ?? null,
      referenceId: transaction.reference?.id ?? null,
      actorUserId: transaction.actor.actorUserId,
      actorRole: transaction.actor.actorRole,
      reversesTransactionId: transaction.reversesTransactionId,
      postedAt:
        transaction.postedAt !== null ? new Date(transaction.postedAt) : null,
      createdAt: new Date(transaction.createdAt),
    },
  });

  for (const entry of mutation.ledgerEntries) {
    await tx.walletLedgerEntry.create({
      data: {
        id: entry.id,
        tenantId: entry.tenantId,
        transactionId: entry.transactionId,
        accountId: entry.accountId,
        direction: entry.direction,
        amountMinor: entry.amountMinor,
        currency: entry.currency,
        postedAt: new Date(entry.postedAt),
      },
    });
  }
}

async function resolveExistingIdempotency<T>(
  existing: {
    commandFingerprint: string;
    resultSnapshot: T;
  } | null,
  fingerprint: string,
  freshResult: T,
): Promise<WalletResult<T>> {
  if (existing === null) {
    return walletOk(freshResult);
  }
  return resolveIdempotencyReplay(
    {
      tenantId: "",
      creationIdempotencyKey: "",
      commandFingerprint: existing.commandFingerprint,
      resultSnapshot: existing.resultSnapshot,
    },
    fingerprint,
    freshResult,
  );
}

export class PrismaWalletRepository {
  async findMemberAccount(
    query: FindMemberWalletAccountQuery,
  ): Promise<WalletResult<WalletAccount | null>> {
    const tenantId = query.tenantId.trim();
    const workspaceId = query.workspaceId.trim();
    const userId = query.userId.trim();
    const currencyResult = normalizeCurrency(query.currency);
    if (!currencyResult.ok) {
      return currencyResult;
    }

    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.walletAccount.findFirst({
        where: {
          tenantId,
          workspaceId,
          userId,
          currency: currencyResult.value,
        },
      });
      return walletOk(row === null ? null : mapWalletAccount(row));
    });
  }

  async getOrCreateAccount(
    input: GetOrCreateWalletAccountInput,
  ): Promise<WalletResult<WalletAccount>> {
    const tenantId = input.tenantId.trim();
    const workspaceId = input.workspaceId.trim();
    const userId = input.userId.trim();
    const currencyResult = normalizeCurrency(input.currency);
    if (!currencyResult.ok) {
      return currencyResult;
    }

    return withTenantRls(tenantId, async (tx) => {
      const existing = await tx.walletAccount.findUnique({
        where: {
          tenantId_workspaceId_userId_currency: {
            tenantId,
            workspaceId,
            userId,
            currency: currencyResult.value,
          },
        },
      });
      if (existing !== null) {
        return walletOk(mapWalletAccount(existing));
      }

      try {
        const created = await tx.walletAccount.create({
          data: {
            id: input.accountId ?? randomUUID(),
            tenantId,
            workspaceId,
            userId,
            currency: currencyResult.value,
            status: "active",
          },
        });
        return walletOk(mapWalletAccount(created));
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          const raced = await tx.walletAccount.findUnique({
            where: {
              tenantId_workspaceId_userId_currency: {
                tenantId,
                workspaceId,
                userId,
                currency: currencyResult.value,
              },
            },
          });
          if (raced !== null) {
            return walletOk(mapWalletAccount(raced));
          }
        }
        throw error;
      }
    });
  }

  async findAccountById(
    tenantId: string,
    accountId: string,
  ): Promise<WalletAccount | null> {
    return withTenantRls(tenantId.trim(), async (tx) =>
      loadAccount(tx, tenantId.trim(), accountId.trim()),
    );
  }

  async getMemberBalance(
    scope: WalletMemberScope,
    accountId: string,
  ): Promise<WalletResult<WalletBalance>> {
    const tenantId = scope.tenantId.trim();
    return withTenantRls(tenantId, async (tx) => {
      const account = await loadAccount(tx, tenantId, accountId.trim());
      if (account === null) {
        return walletErr("WALLET_OWNERSHIP_MISMATCH", "wallet account not found");
      }
      const ownership = assertMemberScope(account, scope);
      if (!ownership.ok) {
        return ownership;
      }
      const entries = await loadLedgerEntriesForAccount(tx, tenantId, account.id);
      return buildMemberBalanceView(account, entries);
    });
  }

  async operatorCredit(
    input: WalletOperatorCreditInput,
  ): Promise<WalletResult<WalletMutationResult>> {
    const tenantId = input.tenantId.trim();
    const nowIso = new Date().toISOString();
    const command = {
      tenantId,
      workspaceId: input.workspaceId.trim(),
      userId: input.userId.trim(),
      accountId: input.accountId.trim(),
      amountMinor: input.amountMinor,
      currency: input.currency,
      creationIdempotencyKey: input.creationIdempotencyKey.trim(),
      reference: input.reference,
      actor: input.actor,
      transactionId: randomUUID(),
      ledgerEntryId: randomUUID(),
      nowIso,
    };
    const fingerprint = operatorCreditFingerprint(command);

    return withTenantRls(tenantId, async (tx) => {
      const existing = await loadMutationByIdempotencyKey(
        tx,
        tenantId,
        command.creationIdempotencyKey,
      );
      if (existing !== null) {
        const replay = await resolveExistingIdempotency(
          {
            commandFingerprint: existing.commandFingerprint,
            resultSnapshot: {
              transaction: existing.transaction,
              ledgerEntries: existing.ledgerEntries,
            },
          },
          fingerprint,
          {
            transaction: existing.transaction,
            ledgerEntries: existing.ledgerEntries,
          },
        );
        return replay;
      }

      const account = await loadAccount(tx, tenantId, command.accountId);
      if (account === null) {
        return walletErr("WALLET_OWNERSHIP_MISMATCH", "wallet account not found");
      }

      await advisoryLockWalletAccount(tx, tenantId, account.id);

      const mutation = createOperatorCredit(account, command);
      if (!mutation.ok) {
        return mutation;
      }

      try {
        await persistMutation(tx, mutation.value, fingerprint);
        await appendWalletMutationAudit(tx, mutation.value, input.actor);
        return mutation;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          const raced = await loadMutationByIdempotencyKey(
            tx,
            tenantId,
            command.creationIdempotencyKey,
          );
          if (raced !== null) {
            return resolveExistingIdempotency(
              {
                commandFingerprint: raced.commandFingerprint,
                resultSnapshot: {
                  transaction: raced.transaction,
                  ledgerEntries: raced.ledgerEntries,
                },
              },
              fingerprint,
              {
                transaction: raced.transaction,
                ledgerEntries: raced.ledgerEntries,
              },
            );
          }
        }
        throw error;
      }
    });
  }

  async operatorDebit(
    input: WalletOperatorDebitInput,
  ): Promise<WalletResult<WalletMutationResult>> {
    const tenantId = input.tenantId.trim();
    const nowIso = new Date().toISOString();
    const command = {
      tenantId,
      workspaceId: input.workspaceId.trim(),
      userId: input.userId.trim(),
      accountId: input.accountId.trim(),
      amountMinor: input.amountMinor,
      currency: input.currency,
      creationIdempotencyKey: input.creationIdempotencyKey.trim(),
      reference: input.reference,
      actor: input.actor,
      transactionId: randomUUID(),
      ledgerEntryId: randomUUID(),
      nowIso,
    };
    const fingerprint = operatorDebitFingerprint(command);

    return withTenantRls(tenantId, async (tx) => {
      const existing = await loadMutationByIdempotencyKey(
        tx,
        tenantId,
        command.creationIdempotencyKey,
      );
      if (existing !== null) {
        return resolveExistingIdempotency(
          {
            commandFingerprint: existing.commandFingerprint,
            resultSnapshot: {
              transaction: existing.transaction,
              ledgerEntries: existing.ledgerEntries,
            },
          },
          fingerprint,
          {
            transaction: existing.transaction,
            ledgerEntries: existing.ledgerEntries,
          },
        );
      }

      const account = await loadAccount(tx, tenantId, command.accountId);
      if (account === null) {
        return walletErr("WALLET_OWNERSHIP_MISMATCH", "wallet account not found");
      }

      await advisoryLockWalletAccount(tx, tenantId, account.id);

      const currentEntries = await loadLedgerEntriesForAccount(
        tx,
        tenantId,
        account.id,
      );
      const mutation = createOperatorDebit(account, command, currentEntries);
      if (!mutation.ok) {
        return mutation;
      }

      try {
        await persistMutation(tx, mutation.value, fingerprint);
        await appendWalletMutationAudit(tx, mutation.value, input.actor);
        return mutation;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          const raced = await loadMutationByIdempotencyKey(
            tx,
            tenantId,
            command.creationIdempotencyKey,
          );
          if (raced !== null) {
            return resolveExistingIdempotency(
              {
                commandFingerprint: raced.commandFingerprint,
                resultSnapshot: {
                  transaction: raced.transaction,
                  ledgerEntries: raced.ledgerEntries,
                },
              },
              fingerprint,
              {
                transaction: raced.transaction,
                ledgerEntries: raced.ledgerEntries,
              },
            );
          }
        }
        throw error;
      }
    });
  }

  async reverseTransaction(
    input: WalletReversalInput,
  ): Promise<WalletResult<WalletMutationResult>> {
    const tenantId = input.tenantId.trim();
    const nowIso = new Date().toISOString();
    const command = {
      tenantId,
      workspaceId: input.workspaceId.trim(),
      userId: input.userId.trim(),
      accountId: input.accountId.trim(),
      creationIdempotencyKey: input.creationIdempotencyKey.trim(),
      reference: input.reference,
      actor: input.actor,
      originalTransactionId: input.originalTransactionId.trim(),
      reversalTransactionId: randomUUID(),
      reversalLedgerEntryId: randomUUID(),
      nowIso,
    };
    const fingerprint = reversalFingerprint(command);

    return withTenantRls(tenantId, async (tx) => {
      const existing = await loadMutationByIdempotencyKey(
        tx,
        tenantId,
        command.creationIdempotencyKey,
      );
      if (existing !== null) {
        return resolveExistingIdempotency(
          {
            commandFingerprint: existing.commandFingerprint,
            resultSnapshot: {
              transaction: existing.transaction,
              ledgerEntries: existing.ledgerEntries,
            },
          },
          fingerprint,
          {
            transaction: existing.transaction,
            ledgerEntries: existing.ledgerEntries,
          },
        );
      }

      const account = await loadAccount(tx, tenantId, command.accountId);
      if (account === null) {
        return walletErr("WALLET_OWNERSHIP_MISMATCH", "wallet account not found");
      }

      await advisoryLockWalletAccount(tx, tenantId, account.id);

      const originalRow = await tx.walletTransaction.findFirst({
        where: {
          id: command.originalTransactionId,
          tenantId,
          accountId: account.id,
        },
        include: { ledgerEntries: true },
      });
      if (originalRow === null) {
        return walletErr("WALLET_REVERSAL_INVALID", "original transaction not found");
      }

      const existingReversal = await tx.walletTransaction.findFirst({
        where: {
          tenantId,
          reversesTransactionId: originalRow.id,
          status: "posted",
        },
      });

      const originalTransaction = mapWalletTransaction(originalRow);
      const originalEntries = originalRow.ledgerEntries.map(mapWalletLedgerEntry);
      const mutation = createReversal(
        account,
        command,
        originalTransaction,
        originalEntries,
        existingReversal === null ? null : mapWalletTransaction(existingReversal),
      );
      if (!mutation.ok) {
        return mutation;
      }

      try {
        await persistMutation(tx, mutation.value, fingerprint);
        await appendWalletMutationAudit(tx, mutation.value, input.actor);
        return mutation;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          const raced = await loadMutationByIdempotencyKey(
            tx,
            tenantId,
            command.creationIdempotencyKey,
          );
          if (raced !== null) {
            return resolveExistingIdempotency(
              {
                commandFingerprint: raced.commandFingerprint,
                resultSnapshot: {
                  transaction: raced.transaction,
                  ledgerEntries: raced.ledgerEntries,
                },
              },
              fingerprint,
              {
                transaction: raced.transaction,
                ledgerEntries: raced.ledgerEntries,
              },
            );
          }
        }
        throw error;
      }
    });
  }

  async listMemberTransactions(
    scope: WalletMemberScope,
    accountId: string,
    query: WalletMemberTransactionsQuery,
  ): Promise<
    WalletResult<{
      readonly page: WalletHistoryPage;
      readonly nextCursor: string | null;
      readonly hasMore: boolean;
    }>
  > {
    const tenantId = scope.tenantId.trim();
    const limit = Math.min(Math.max(query.limit, 1), 200);

    return withTenantRls(tenantId, async (tx) => {
      const account = await loadAccount(tx, tenantId, accountId.trim());
      if (account === null) {
        return walletErr("WALLET_OWNERSHIP_MISMATCH", "wallet account not found");
      }
      const ownership = assertMemberScope(account, scope);
      if (!ownership.ok) {
        return ownership;
      }

      const cursor = query.cursor?.trim();
      const rows = await tx.walletTransaction.findMany({
        where: {
          tenantId,
          accountId: account.id,
          status: "posted",
          ...(cursor !== undefined && cursor.length > 0
            ? { id: { lt: cursor } }
            : {}),
        },
        orderBy: { id: "desc" },
        take: limit + 1,
        include: { ledgerEntries: true },
      });

      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const transactions = pageRows.map(mapWalletTransaction);
      const entries = pageRows.flatMap((row) =>
        row.ledgerEntries.map(mapWalletLedgerEntry),
      );

      const history = buildMemberTransactionHistory(account, transactions, entries);
      if (!history.ok) {
        return history;
      }

      const nextCursor =
        hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1]!.id : null;

      return walletOk({
        page: history.value,
        nextCursor,
        hasMore,
      });
    });
  }

  async lookupOperatorAccounts(
    query: WalletOperatorAccountLookupQuery,
  ): Promise<
    WalletResult<
      readonly {
        readonly account: WalletAccount;
        readonly balanceMinor: string;
      }[]
    >
  > {
    const tenantId = query.tenantId.trim();
    const userId = query.userId.trim();

    return withTenantRls(tenantId, async (tx) => {
      const where: Prisma.WalletAccountWhereInput = {
        tenantId,
        userId,
        ...(query.workspaceId !== undefined
          ? { workspaceId: query.workspaceId.trim() }
          : {}),
        ...(query.currency !== undefined ? { currency: query.currency.trim() } : {}),
      };

      const accounts = await tx.walletAccount.findMany({
        where,
        orderBy: { currency: "asc" },
      });

      const items: { account: WalletAccount; balanceMinor: string }[] = [];
      for (const row of accounts) {
        const account = mapWalletAccount(row);
        const entries = await loadLedgerEntriesForAccount(tx, tenantId, account.id);
        const balance = buildMemberBalanceView(account, entries);
        if (!balance.ok) {
          return balance;
        }
        items.push({
          account,
          balanceMinor: balance.value.balanceMinor,
        });
      }

      return walletOk(items);
    });
  }
}
