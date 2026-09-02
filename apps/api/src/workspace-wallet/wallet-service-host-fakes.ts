/**
 * WALLET-P2D — in-memory fakes for wallet HTTP handler tests.
 */
import type { WalletServicePort } from "@app-tour/wallet-http";
import type {
  WalletBalanceHttpResponse,
  WalletMutationHttpResponse,
  WalletOperatorAccountsHttpResponse,
  WalletTransactionHistoryHttpResponse,
} from "@app-tour/wallet-http-contracts";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

const TENANT = "00000000-0000-4000-8000-000000000099";
const MEMBER_USER = "00000000-0000-4000-8000-000000000001";
const OTHER_MEMBER = "00000000-0000-4000-8000-000000000002";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000010";
const WORKSPACE = "wallet-ws1";

export const WALLET_HTTP_TEST_TENANT = TENANT;
export const WALLET_HTTP_TEST_ACCOUNT_ID = ACCOUNT_ID;

export const WALLET_MEMBER_AUTH: TenantAuthContext = {
  userId: MEMBER_USER,
  tenantId: TENANT,
  role: "member",
  status: "ACTIVE",
  workspaceId: WORKSPACE,
};

export const WALLET_OPERATOR_AUTH: TenantAuthContext = {
  userId: "00000000-0000-4000-8000-000000000003",
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: WORKSPACE,
};

type FakeWalletState = {
  readonly balances: Map<string, WalletBalanceHttpResponse>;
  readonly transactions: Map<string, WalletTransactionHistoryHttpResponse>;
  readonly idempotency: Map<string, WalletMutationHttpResponse>;
  moduleEnabled: boolean;
  workspaceSupported: boolean;
  memberEntitled: boolean;
  insufficientFunds: boolean;
};

export function createFakeWalletService(
  overrides?: Partial<FakeWalletState>,
): WalletServicePort & { readonly state: FakeWalletState } {
  const state: FakeWalletState = {
    balances: new Map([
      [
        ACCOUNT_ID,
        { accountId: ACCOUNT_ID, currency: "IRR", balanceMinor: "5000" },
      ],
    ]),
    transactions: new Map([
      [
        ACCOUNT_ID,
        {
          accountId: ACCOUNT_ID,
          currency: "IRR",
          items: [],
          nextCursor: null,
          hasMore: false,
        },
      ],
    ]),
    idempotency: new Map(),
    moduleEnabled: true,
    workspaceSupported: true,
    memberEntitled: true,
    insufficientFunds: false,
    ...overrides,
  };

  function gate(auth: TenantAuthContext): void {
    if (!state.workspaceSupported) {
      throw new Error("WALLET_WORKSPACE_UNSUPPORTED");
    }
    if (!state.moduleEnabled) {
      throw new Error("FORBIDDEN_WALLET_MODULE_DISABLED");
    }
    if (auth.role === "member" && !state.memberEntitled) {
      throw new Error("FORBIDDEN_MEMBER_MODULE_WALLET");
    }
    if (auth.role === "member" && auth.userId === OTHER_MEMBER) {
      throw new Error("WALLET_OWNERSHIP_MISMATCH");
    }
    if (auth.role !== "member" && auth.role !== "admin" && auth.role !== "owner") {
      throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
    }
  }

  return {
    state,
    async getMemberOwnBalance(auth) {
      gate(auth);
      if (auth.role !== "member") {
        throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
      }
      const balance = state.balances.get(ACCOUNT_ID);
      if (balance === undefined) {
        return {
          accountId: null,
          currency: "IRR",
          balanceMinor: "0",
          availableBalanceMinor: "0",
        };
      }
      return {
        accountId: balance.accountId,
        currency: balance.currency,
        balanceMinor: balance.balanceMinor,
        availableBalanceMinor: balance.balanceMinor,
      };
    },
    async getMemberOwnTransactions(auth, query) {
      gate(auth);
      if (auth.role !== "member") {
        throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
      }
      const page = state.transactions.get(ACCOUNT_ID);
      if (page === undefined) {
        return {
          accountId: "",
          currency: "IRR",
          items: [],
          nextCursor: null,
          hasMore: false,
        };
      }
      return { ...page, ...query };
    },
    async getMemberBalance(auth, accountId) {
      gate(auth);
      if (auth.role !== "member") {
        throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
      }
      const balance = state.balances.get(accountId);
      if (balance === undefined) {
        throw new Error("WALLET_OWNERSHIP_MISMATCH");
      }
      return balance;
    },
    async getMemberTransactions(auth, accountId, query) {
      gate(auth);
      if (auth.role !== "member") {
        throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
      }
      const page = state.transactions.get(accountId);
      if (page === undefined) {
        throw new Error("WALLET_OWNERSHIP_MISMATCH");
      }
      return { ...page, ...query };
    },
    async lookupOperatorAccounts(auth, query) {
      gate(auth);
      if (auth.role === "member") {
        throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
      }
      const body: WalletOperatorAccountsHttpResponse = {
        items: [
          {
            id: ACCOUNT_ID,
            userId: query.userId,
            workspaceId: WORKSPACE,
            currency: "IRR",
            status: "active",
            balanceMinor: "5000",
          },
        ],
      };
      return body;
    },
    async operatorCredit(auth, accountId, body, idempotencyKey) {
      gate(auth);
      if (auth.role === "member") {
        throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
      }
      const existing = state.idempotency.get(idempotencyKey);
      if (existing !== undefined) {
        return { ...existing, replay: true };
      }
      const created: WalletMutationHttpResponse = {
        transactionId: "00000000-0000-4000-8000-000000000020",
        accountId,
        kind: "operator_credit",
        status: "posted",
        amountMinor: body.amountMinor,
        currency: body.currency,
        postedAt: new Date().toISOString(),
        replay: false,
      };
      state.idempotency.set(idempotencyKey, created);
      return created;
    },
    async operatorDebit(auth, accountId, body, idempotencyKey) {
      gate(auth);
      if (auth.role === "member") {
        throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
      }
      if (state.insufficientFunds) {
        throw new Error("WALLET_INSUFFICIENT_FUNDS");
      }
      const existing = state.idempotency.get(idempotencyKey);
      if (existing !== undefined) {
        return { ...existing, replay: true };
      }
      const created: WalletMutationHttpResponse = {
        transactionId: "00000000-0000-4000-8000-000000000021",
        accountId,
        kind: "operator_debit",
        status: "posted",
        amountMinor: body.amountMinor,
        currency: body.currency,
        postedAt: new Date().toISOString(),
        replay: false,
      };
      state.idempotency.set(idempotencyKey, created);
      return created;
    },
    async reverseTransaction(auth, _transactionId, body, idempotencyKey) {
      gate(auth);
      if (auth.role === "member") {
        throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
      }
      const existing = state.idempotency.get(idempotencyKey);
      if (existing !== undefined) {
        return { ...existing, replay: true };
      }
      const created: WalletMutationHttpResponse = {
        transactionId: "00000000-0000-4000-8000-000000000022",
        accountId: body.accountId,
        kind: "reversal",
        status: "posted",
        amountMinor: "1000",
        currency: "IRR",
        postedAt: new Date().toISOString(),
        replay: false,
      };
      state.idempotency.set(idempotencyKey, created);
      return created;
    },
  };
}
