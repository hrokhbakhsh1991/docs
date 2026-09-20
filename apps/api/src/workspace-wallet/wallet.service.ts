/**
 * WALLET-P2D — API host wallet service (authorization + repository orchestration).
 */
import type { WalletServicePort } from "@app-tour/wallet-http";
import type {
  WalletBalanceHttpResponse,
  WalletMemberSummaryHttpResponse,
  WalletMutationHttpResponse,
  WalletOperatorAccountsHttpResponse,
  WalletTransactionHistoryHttpResponse,
  WalletTransactionHttpItem,
} from "@app-tour/wallet-http-contracts";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type { WalletAuthorizationPort } from "@app-tour/wallet-core/ports";
import type {
  WalletCapabilityPort,
  WalletWorkspaceGateResult,
} from "@app-tour/workspace-sdk/wallet";

import { throwWalletDomainError } from "@app-tour/wallet-http";
import {
  assertWalletMemberReadAccess,
  assertWalletOperatorAccess,
} from "./assert-wallet-operator-access";
import type { PrismaWalletRepository } from "./infrastructure/prisma-wallet.repository";
import { HostWalletAuthorizationAdapter } from "./infrastructure/host-wallet-authorization.adapter";

function mapTransactionItem(
  transaction: import("@app-tour/wallet-core").WalletTransaction
): WalletTransactionHttpItem {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    kind: transaction.kind,
    status: "posted",
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    reference:
      transaction.reference !== null
        ? { type: transaction.reference.type, id: transaction.reference.id }
        : null,
    reversesTransactionId: transaction.reversesTransactionId,
    postedAt: transaction.postedAt ?? transaction.createdAt,
  };
}

function mapMutationResult(
  mutation: import("@app-tour/wallet-core").WalletMutationResult,
  replay: boolean
): WalletMutationHttpResponse {
  const transaction = mutation.transaction;
  return {
    transactionId: transaction.id,
    accountId: transaction.accountId,
    kind: transaction.kind,
    status: "posted",
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    postedAt: transaction.postedAt ?? transaction.createdAt,
    replay,
  };
}

export type WalletServiceDeps = {
  readonly repository: PrismaWalletRepository;
  readonly capability: WalletCapabilityPort;
};

function resolveMemberWalletCurrency(gate: WalletWorkspaceGateResult): string {
  const theme = gate.theme;
  if (theme !== null && typeof theme === "object" && !Array.isArray(theme)) {
    const commerce = (theme as { commerce?: unknown }).commerce;
    if (commerce !== null && typeof commerce === "object" && !Array.isArray(commerce)) {
      const currency = (commerce as { currency?: unknown }).currency;
      if (typeof currency === "string" && currency.trim().length > 0) {
        return currency.trim().toUpperCase();
      }
    }
  }
  return "USD";
}

function requireMemberWorkspaceId(auth: TenantAuthContext): string {
  const workspaceId = auth.workspaceId?.trim();
  if (workspaceId === undefined || workspaceId.length === 0) {
    throw new Error("WALLET_OWNERSHIP_MISMATCH");
  }
  return workspaceId;
}

export function createWalletService(deps: WalletServiceDeps): WalletServicePort {
  const { repository, capability } = deps;

  async function resolveGateAndAuth(auth: TenantAuthContext): Promise<WalletAuthorizationPort> {
    const gate = await capability.assertEnabled(auth.tenantId);
    return new HostWalletAuthorizationAdapter(auth, gate);
  }

  async function loadAccountForMember(
    auth: TenantAuthContext,
    accountId: string,
    authorization: WalletAuthorizationPort
  ) {
    const account = await repository.findAccountById(auth.tenantId, accountId);
    if (account === null) {
      throw new Error("WALLET_OWNERSHIP_MISMATCH");
    }
    if (auth.role === "owner" || auth.role === "admin") {
      assertWalletOperatorAccess(auth);
      const authz = await authorization.assertOperatorCredit({
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        actorUserId: auth.userId,
      });
      if (!authz.ok) {
        throwWalletDomainError(authz.error);
      }
      return account;
    }
    const authz = await authorization.assertMemberReadOwnAccount({
      tenantId: auth.tenantId,
      workspaceId: account.workspaceId,
      actorUserId: auth.userId,
      accountUserId: account.userId,
    });
    if (!authz.ok) {
      throwWalletDomainError(authz.error);
    }
    return account;
  }

  return {
    async getMemberOwnBalance(auth) {
      assertWalletMemberReadAccess(auth);
      const gate = await capability.assertEnabled(auth.tenantId);
      const authorization = new HostWalletAuthorizationAdapter(auth, gate);
      const workspaceId = requireMemberWorkspaceId(auth);
      const currency = resolveMemberWalletCurrency(gate);
      const accountResult = await repository.findMemberAccount({
        tenantId: auth.tenantId,
        workspaceId,
        userId: auth.userId,
        currency,
      });
      if (!accountResult.ok) {
        throwWalletDomainError(accountResult.error);
      }
      const account = accountResult.value;
      if (account === null) {
        const empty: WalletMemberSummaryHttpResponse = {
          accountId: null,
          currency,
          balanceMinor: "0",
          availableBalanceMinor: "0",
        };
        return empty;
      }
      const authz = await authorization.assertMemberReadOwnAccount({
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        actorUserId: auth.userId,
        accountUserId: account.userId,
      });
      if (!authz.ok) {
        throwWalletDomainError(authz.error);
      }
      const balance = await repository.getMemberBalance(
        { tenantId: auth.tenantId, workspaceId, userId: auth.userId },
        account.id
      );
      if (!balance.ok) {
        throwWalletDomainError(balance.error);
      }
      return {
        accountId: balance.value.accountId,
        currency: balance.value.currency,
        balanceMinor: balance.value.balanceMinor,
        availableBalanceMinor: balance.value.balanceMinor,
      };
    },

    async getMemberOwnTransactions(auth, query) {
      assertWalletMemberReadAccess(auth);
      const gate = await capability.assertEnabled(auth.tenantId);
      const authorization = new HostWalletAuthorizationAdapter(auth, gate);
      const workspaceId = requireMemberWorkspaceId(auth);
      const currency = resolveMemberWalletCurrency(gate);
      const accountResult = await repository.findMemberAccount({
        tenantId: auth.tenantId,
        workspaceId,
        userId: auth.userId,
        currency,
      });
      if (!accountResult.ok) {
        throwWalletDomainError(accountResult.error);
      }
      const account = accountResult.value;
      if (account === null) {
        return {
          accountId: "",
          currency,
          items: [],
          nextCursor: null,
          hasMore: false,
        };
      }
      const authz = await authorization.assertMemberReadOwnAccount({
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        actorUserId: auth.userId,
        accountUserId: account.userId,
      });
      if (!authz.ok) {
        throwWalletDomainError(authz.error);
      }
      const result = await repository.listMemberTransactions(
        { tenantId: auth.tenantId, workspaceId, userId: auth.userId },
        account.id,
        query
      );
      if (!result.ok) {
        throwWalletDomainError(result.error);
      }
      return {
        accountId: result.value.page.accountId,
        currency: result.value.page.currency,
        items: result.value.page.items.map((item) => mapTransactionItem(item.transaction)),
        nextCursor: result.value.nextCursor,
        hasMore: result.value.hasMore,
      };
    },

    async getMemberBalance(auth, accountId) {
      const authorization = await resolveGateAndAuth(auth);
      const account = await loadAccountForMember(auth, accountId, authorization);
      const scope = {
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        userId: account.userId,
      };
      const result = await repository.getMemberBalance(scope, account.id);
      if (!result.ok) {
        throwWalletDomainError(result.error);
      }
      const body: WalletBalanceHttpResponse = {
        accountId: result.value.accountId,
        currency: result.value.currency,
        balanceMinor: result.value.balanceMinor,
      };
      return body;
    },

    async getMemberTransactions(auth, accountId, query) {
      const authorization = await resolveGateAndAuth(auth);
      const account = await loadAccountForMember(auth, accountId, authorization);
      const scope = {
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        userId: account.userId,
      };
      const result = await repository.listMemberTransactions(scope, account.id, query);
      if (!result.ok) {
        throwWalletDomainError(result.error);
      }
      const body: WalletTransactionHistoryHttpResponse = {
        accountId: result.value.page.accountId,
        currency: result.value.page.currency,
        items: result.value.page.items.map((item) => mapTransactionItem(item.transaction)),
        nextCursor: result.value.nextCursor,
        hasMore: result.value.hasMore,
      };
      return body;
    },

    async lookupOperatorAccounts(auth, query) {
      const authorization = await resolveGateAndAuth(auth);
      const authz = await authorization.assertOperatorCredit({
        tenantId: auth.tenantId,
        workspaceId: query.workspaceId ?? auth.workspaceId ?? "",
        actorUserId: auth.userId,
      });
      if (!authz.ok) {
        throwWalletDomainError(authz.error);
      }

      const result = await repository.lookupOperatorAccounts({
        tenantId: auth.tenantId,
        userId: query.userId,
        ...(query.currency !== undefined ? { currency: query.currency } : {}),
        ...(query.workspaceId !== undefined ? { workspaceId: query.workspaceId } : {}),
      });
      if (!result.ok) {
        throwWalletDomainError(result.error);
      }

      const body: WalletOperatorAccountsHttpResponse = {
        items: result.value.map((row) => ({
          id: row.account.id,
          userId: row.account.userId,
          workspaceId: row.account.workspaceId,
          currency: row.account.currency,
          status: row.account.status,
          balanceMinor: row.balanceMinor,
        })),
      };
      return body;
    },

    async operatorCredit(auth, accountId, body, idempotencyKey) {
      const authorization = await resolveGateAndAuth(auth);
      const account = await repository.findAccountById(auth.tenantId, accountId);
      if (account === null) {
        throw new Error("WALLET_OWNERSHIP_MISMATCH");
      }
      const authz = await authorization.assertOperatorCredit({
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        actorUserId: auth.userId,
      });
      if (!authz.ok) {
        throwWalletDomainError(authz.error);
      }

      const result = await repository.operatorCredit({
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        userId: account.userId,
        accountId: account.id,
        amountMinor: body.amountMinor,
        currency: body.currency,
        creationIdempotencyKey: idempotencyKey,
        reference: body.reference ?? null,
        actor: { actorUserId: auth.userId, actorRole: "operator" },
      });
      if (!result.ok) {
        throwWalletDomainError(result.error);
      }
      return mapMutationResult(result.value, false);
    },

    async operatorDebit(auth, accountId, body, idempotencyKey) {
      const authorization = await resolveGateAndAuth(auth);
      const account = await repository.findAccountById(auth.tenantId, accountId);
      if (account === null) {
        throw new Error("WALLET_OWNERSHIP_MISMATCH");
      }
      const authz = await authorization.assertOperatorDebit({
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        actorUserId: auth.userId,
      });
      if (!authz.ok) {
        throwWalletDomainError(authz.error);
      }

      const result = await repository.operatorDebit({
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        userId: account.userId,
        accountId: account.id,
        amountMinor: body.amountMinor,
        currency: body.currency,
        creationIdempotencyKey: idempotencyKey,
        reference: body.reference ?? null,
        actor: { actorUserId: auth.userId, actorRole: "operator" },
      });
      if (!result.ok) {
        throwWalletDomainError(result.error);
      }
      return mapMutationResult(result.value, false);
    },

    async reverseTransaction(auth, transactionId, body, idempotencyKey) {
      const authorization = await resolveGateAndAuth(auth);
      const account = await repository.findAccountById(auth.tenantId, body.accountId);
      if (account === null) {
        throw new Error("WALLET_OWNERSHIP_MISMATCH");
      }
      const authz = await authorization.assertTransactionReversal({
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        actorUserId: auth.userId,
        originalTransactionId: transactionId,
      });
      if (!authz.ok) {
        throwWalletDomainError(authz.error);
      }

      const result = await repository.reverseTransaction({
        tenantId: auth.tenantId,
        workspaceId: account.workspaceId,
        userId: account.userId,
        accountId: account.id,
        originalTransactionId: transactionId,
        creationIdempotencyKey: idempotencyKey,
        reference: body.reference ?? null,
        actor: { actorUserId: auth.userId, actorRole: "operator" },
      });
      if (!result.ok) {
        throwWalletDomainError(result.error);
      }
      return mapMutationResult(result.value, false);
    },
  };
}

export type WalletService = ReturnType<typeof createWalletService>;
