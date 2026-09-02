export const WALLET_ACCOUNT_STATUSES = [
  "active",
  "suspended",
  "closed",
] as const;

export type WalletAccountStatus = (typeof WALLET_ACCOUNT_STATUSES)[number];

export const WALLET_TRANSACTION_STATUSES = [
  "pending",
  "posted",
  "failed",
  "cancelled",
] as const;

export type WalletTransactionStatus =
  (typeof WALLET_TRANSACTION_STATUSES)[number];

export const WALLET_TRANSACTION_KINDS = [
  "operator_credit",
  "operator_debit",
  "reversal",
] as const;

export type WalletTransactionKind = (typeof WALLET_TRANSACTION_KINDS)[number];

export const LEDGER_DIRECTIONS = ["credit", "debit"] as const;

export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

export type WalletReference = {
  readonly type: string;
  readonly id: string;
};

export const WALLET_ACTOR_ROLES = ["operator", "member", "system"] as const;

export type WalletActorRole = (typeof WALLET_ACTOR_ROLES)[number];

export type WalletActor = {
  readonly actorUserId: string;
  readonly actorRole: WalletActorRole;
};

export type WalletAccount = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly status: WalletAccountStatus;
  readonly currency: string;
};

export type WalletTransaction = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly kind: WalletTransactionKind;
  readonly status: WalletTransactionStatus;
  readonly amountMinor: string;
  readonly currency: string;
  readonly creationIdempotencyKey: string | null;
  readonly reference: WalletReference | null;
  readonly actor: WalletActor;
  readonly reversesTransactionId: string | null;
  readonly createdAt: string;
  readonly postedAt: string | null;
};

/**
 * Append-only ledger entry concept. Posted entries are immutable facts.
 */
export type WalletLedgerEntry = {
  readonly id: string;
  readonly tenantId: string;
  readonly transactionId: string;
  readonly accountId: string;
  readonly direction: LedgerDirection;
  readonly amountMinor: string;
  readonly currency: string;
  readonly postedAt: string;
};

export type WalletBalance = {
  readonly accountId: string;
  readonly currency: string;
  readonly balanceMinor: string;
};

export type WalletHistoryItem = {
  readonly transaction: WalletTransaction;
  readonly ledgerEntries: readonly WalletLedgerEntry[];
};

export type WalletHistoryPage = {
  readonly accountId: string;
  readonly currency: string;
  readonly items: readonly WalletHistoryItem[];
};
