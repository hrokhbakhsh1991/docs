import type { WalletResult } from "../domain/errors";

export type MemberReadAccountAuthzInput = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly accountUserId: string;
};

export type OperatorCreditAuthzInput = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
};

export type OperatorDebitAuthzInput = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
};

export type TransactionReversalAuthzInput = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly originalTransactionId: string;
};

export interface WalletAuthorizationPort {
  assertMemberReadOwnAccount(
    input: MemberReadAccountAuthzInput,
  ): Promise<WalletResult<void>>;

  assertOperatorCredit(
    input: OperatorCreditAuthzInput,
  ): Promise<WalletResult<void>>;

  assertOperatorDebit(
    input: OperatorDebitAuthzInput,
  ): Promise<WalletResult<void>>;

  assertTransactionReversal(
    input: TransactionReversalAuthzInput,
  ): Promise<WalletResult<void>>;
}
