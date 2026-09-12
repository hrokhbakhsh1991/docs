import type { WalletLedgerRepository } from "@app-tour/wallet-core";

import { withTenantRls } from "../../db/with-tenant-rls";
import { mapWalletLedgerEntry } from "./wallet-prisma-mappers";

export class PrismaWalletLedgerRepository implements WalletLedgerRepository {
  async listByAccount(
    tenantId: string,
    accountId: string,
  ): Promise<readonly import("@app-tour/wallet-core").WalletLedgerEntry[]> {
    return withTenantRls(tenantId.trim(), async (tx) => {
      const rows = await tx.walletLedgerEntry.findMany({
        where: { tenantId: tenantId.trim(), accountId: accountId.trim() },
        orderBy: { postedAt: "asc" },
      });
      return rows.map(mapWalletLedgerEntry);
    });
  }

  async listByTransaction(
    tenantId: string,
    transactionId: string,
  ): Promise<readonly import("@app-tour/wallet-core").WalletLedgerEntry[]> {
    return withTenantRls(tenantId.trim(), async (tx) => {
      const rows = await tx.walletLedgerEntry.findMany({
        where: { tenantId: tenantId.trim(), transactionId: transactionId.trim() },
        orderBy: { postedAt: "asc" },
      });
      return rows.map(mapWalletLedgerEntry);
    });
  }
}
