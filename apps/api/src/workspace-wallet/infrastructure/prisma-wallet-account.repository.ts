import type { WalletAccountRepository } from "@app-tour/wallet-core";

import { withTenantRls } from "../../db/with-tenant-rls";
import { mapWalletAccount } from "./wallet-prisma-mappers";

export class PrismaWalletAccountRepository implements WalletAccountRepository {
  async findById(
    tenantId: string,
    accountId: string,
  ): Promise<import("@app-tour/wallet-core").WalletAccount | null> {
    return withTenantRls(tenantId.trim(), async (tx) => {
      const row = await tx.walletAccount.findFirst({
        where: { id: accountId.trim(), tenantId: tenantId.trim() },
      });
      return row === null ? null : mapWalletAccount(row);
    });
  }
}
