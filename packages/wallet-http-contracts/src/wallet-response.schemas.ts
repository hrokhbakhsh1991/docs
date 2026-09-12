/**
 * Wallet HTTP response read models — safe for external exposure (Phase 2D).
 */

export type WalletBalanceHttpResponse = {
  readonly accountId: string;
  readonly currency: string;
  readonly balanceMinor: string;
};

/** Member self-read summary — account may be absent until first operator credit. */
export type WalletMemberSummaryHttpResponse = {
  readonly accountId: string | null;
  readonly currency: string;
  readonly balanceMinor: string;
  readonly availableBalanceMinor: string;
};

export type WalletTransactionHttpItem = {
  readonly id: string;
  readonly accountId: string;
  readonly kind: "operator_credit" | "operator_debit" | "reversal";
  readonly status: "posted";
  readonly amountMinor: string;
  readonly currency: string;
  readonly reference: { readonly type: string; readonly id: string } | null;
  readonly reversesTransactionId: string | null;
  readonly postedAt: string;
};

export type WalletTransactionHistoryHttpResponse = {
  readonly accountId: string;
  readonly currency: string;
  readonly items: readonly WalletTransactionHttpItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export type WalletOperatorAccountHttpItem = {
  readonly id: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly currency: string;
  readonly status: "active" | "suspended" | "closed";
  readonly balanceMinor: string;
};

export type WalletOperatorAccountsHttpResponse = {
  readonly items: readonly WalletOperatorAccountHttpItem[];
};

export type WalletMutationHttpResponse = {
  readonly transactionId: string;
  readonly accountId: string;
  readonly kind: "operator_credit" | "operator_debit" | "reversal";
  readonly status: "posted";
  readonly amountMinor: string;
  readonly currency: string;
  readonly postedAt: string;
  readonly replay: boolean;
};
