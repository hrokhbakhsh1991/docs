import type { WalletTransaction } from "../domain/types";

export interface WalletTransactionRepository {
  findById(
    tenantId: string,
    transactionId: string,
  ): Promise<WalletTransaction | null>;

  findReversalForOriginal(
    tenantId: string,
    originalTransactionId: string,
  ): Promise<WalletTransaction | null>;
}
