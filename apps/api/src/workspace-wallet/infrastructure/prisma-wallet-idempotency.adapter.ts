import type { WalletIdempotencyPort, WalletIdempotencyRecord } from "@app-tour/wallet-core";

import { withTenantRls } from "../../db/with-tenant-rls";
import { mapWalletLedgerEntry, mapWalletTransaction } from "./wallet-prisma-mappers";

export class PrismaWalletIdempotencyAdapter implements WalletIdempotencyPort {
  async lookup(
    tenantId: string,
    creationIdempotencyKey: string,
  ): Promise<WalletIdempotencyRecord | null> {
    return withTenantRls(tenantId.trim(), async (tx) => {
      const row = await tx.walletTransaction.findUnique({
        where: {
          tenantId_creationIdempotencyKey: {
            tenantId: tenantId.trim(),
            creationIdempotencyKey: creationIdempotencyKey.trim(),
          },
        },
        include: { ledgerEntries: true },
      });
      if (row === null) {
        return null;
      }
      return {
        tenantId: row.tenantId,
        creationIdempotencyKey: row.creationIdempotencyKey,
        commandFingerprint: row.commandFingerprint,
        resultSnapshot: {
          transaction: mapWalletTransaction(row),
          ledgerEntries: row.ledgerEntries.map(mapWalletLedgerEntry),
        },
      };
    });
  }

  async save(record: WalletIdempotencyRecord): Promise<void> {
    // Idempotency snapshots are persisted atomically with wallet_transactions rows.
    void record;
  }
}
