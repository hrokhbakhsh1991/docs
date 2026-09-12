import type { WalletAccount } from "../domain/types";

export interface WalletAccountRepository {
  findById(
    tenantId: string,
    accountId: string,
  ): Promise<WalletAccount | null>;
}
