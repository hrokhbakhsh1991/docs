import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type {
  OperatorCreditBody,
  OperatorDebitBody,
  OperatorReversalBody,
  WalletBalanceHttpResponse,
  WalletMutationHttpResponse,
  WalletOperatorAccountsHttpResponse,
  WalletTransactionHistoryHttpResponse,
} from "@app-tour/wallet-http-contracts";

/** Wallet domain port — implemented by API `WalletService` (persistence stays in host). */
export type WalletServicePort = {
  readonly getMemberOwnBalance: (
    auth: TenantAuthContext,
  ) => Promise<import("@app-tour/wallet-http-contracts").WalletMemberSummaryHttpResponse>;

  readonly getMemberOwnTransactions: (
    auth: TenantAuthContext,
    query: { readonly limit: number; readonly cursor?: string },
  ) => Promise<WalletTransactionHistoryHttpResponse>;

  readonly getMemberBalance: (
    auth: TenantAuthContext,
    accountId: string,
  ) => Promise<WalletBalanceHttpResponse>;

  readonly getMemberTransactions: (
    auth: TenantAuthContext,
    accountId: string,
    query: { readonly limit: number; readonly cursor?: string },
  ) => Promise<WalletTransactionHistoryHttpResponse>;

  readonly lookupOperatorAccounts: (
    auth: TenantAuthContext,
    query: {
      readonly userId: string;
      readonly currency?: string;
      readonly workspaceId?: string;
    },
  ) => Promise<WalletOperatorAccountsHttpResponse>;

  readonly operatorCredit: (
    auth: TenantAuthContext,
    accountId: string,
    body: OperatorCreditBody,
    idempotencyKey: string,
  ) => Promise<WalletMutationHttpResponse>;

  readonly operatorDebit: (
    auth: TenantAuthContext,
    accountId: string,
    body: OperatorDebitBody,
    idempotencyKey: string,
  ) => Promise<WalletMutationHttpResponse>;

  readonly reverseTransaction: (
    auth: TenantAuthContext,
    transactionId: string,
    body: OperatorReversalBody,
    idempotencyKey: string,
  ) => Promise<WalletMutationHttpResponse>;
};
