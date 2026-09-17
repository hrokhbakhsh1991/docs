import type { WalletTransactionRepository } from "@app-tour/wallet-core";

import { withTenantRls } from "../../db/with-tenant-rls";
import { mapWalletTransaction } from "./wallet-prisma-mappers";

export class PrismaWalletTransactionRepository implements WalletTransactionRepository {
  async findById(
    tenantId: string,
    transactionId: string,
  ): Promise<import("@app-tour/wallet-core").WalletTransaction | null> {
    return withTenantRls(tenantId.trim(), async (tx) => {
      const row = await tx.walletTransaction.findFirst({
        where: { id: transactionId.trim(), tenantId: tenantId.trim() },
      });
      return row === null ? null : mapWalletTransaction(row);
    });
  }

  async findReversalForOriginal(
    tenantId: string,
    originalTransactionId: string,
  ): Promise<import("@app-tour/wallet-core").WalletTransaction | null> {
    return withTenantRls(tenantId.trim(), async (tx) => {
      const row = await tx.walletTransaction.findFirst({
        where: {
          tenantId: tenantId.trim(),
          reversesTransactionId: originalTransactionId.trim(),
          status: "posted",
        },
      });
      return row === null ? null : mapWalletTransaction(row);
    });
  }
}
