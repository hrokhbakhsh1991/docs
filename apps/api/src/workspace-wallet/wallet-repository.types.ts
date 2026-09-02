/**
 * WALLET-P2C — host repository input contracts (not exposed via wallet-core).
 */
import type { WalletActor, WalletReference } from "@app-tour/wallet-core";

export type WalletMemberScope = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
};

export type GetOrCreateWalletAccountInput = WalletMemberScope & {
  readonly currency: string;
  readonly accountId?: string;
};

export type WalletOperatorMutationInput = WalletMemberScope & {
  readonly accountId: string;
  readonly creationIdempotencyKey: string;
  readonly reference: WalletReference | null;
  readonly actor: WalletActor;
};

export type WalletOperatorCreditInput = WalletOperatorMutationInput & {
  readonly amountMinor: string;
  readonly currency: string;
};

export type WalletOperatorDebitInput = WalletOperatorMutationInput & {
  readonly amountMinor: string;
  readonly currency: string;
};

export type WalletReversalInput = WalletOperatorMutationInput & {
  readonly originalTransactionId: string;
};

export type WalletMemberTransactionsQuery = {
  readonly limit: number;
  readonly cursor?: string;
};

export type WalletOperatorAccountLookupQuery = {
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId?: string;
  readonly currency?: string;
};
