import type { WalletActor, WalletReference } from "../domain/types";

export type OperatorCreditCommand = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly accountId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly creationIdempotencyKey: string;
  readonly reference: WalletReference | null;
  readonly actor: WalletActor;
  readonly transactionId: string;
  readonly ledgerEntryId: string;
  readonly nowIso: string;
};

export type OperatorDebitCommand = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly accountId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly creationIdempotencyKey: string;
  readonly reference: WalletReference | null;
  readonly actor: WalletActor;
  readonly transactionId: string;
  readonly ledgerEntryId: string;
  readonly nowIso: string;
};

export type ReversalCommand = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly accountId: string;
  readonly creationIdempotencyKey: string;
  readonly reference: WalletReference | null;
  readonly actor: WalletActor;
  readonly originalTransactionId: string;
  readonly reversalTransactionId: string;
  readonly reversalLedgerEntryId: string;
  readonly nowIso: string;
};

export type WalletMutationResult = {
  readonly transaction: import("../domain/types").WalletTransaction;
  readonly ledgerEntries: readonly import("../domain/types").WalletLedgerEntry[];
};
