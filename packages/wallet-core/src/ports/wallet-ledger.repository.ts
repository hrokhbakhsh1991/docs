import type { WalletLedgerEntry } from "../domain/types";

export interface WalletLedgerRepository {
  listByAccount(
    tenantId: string,
    accountId: string,
  ): Promise<readonly WalletLedgerEntry[]>;

  listByTransaction(
    tenantId: string,
    transactionId: string,
  ): Promise<readonly WalletLedgerEntry[]>;
}
