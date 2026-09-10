import type { WalletAuditEvent, WalletAuditPort } from "@app-tour/wallet-core";

import { withTenantRls } from "../../db/with-tenant-rls";
import { appendWalletReadAudit } from "../wallet-audit-writer";

export class PrismaWalletAuditAdapter implements WalletAuditPort {
  async record(event: WalletAuditEvent): Promise<void> {
    await withTenantRls(event.tenantId.trim(), async (tx) => {
      if (event.action === "member_balance_read") {
        await appendWalletReadAudit(tx, {
          action: "WALLET_MEMBER_BALANCE_READ",
          accountId: event.accountId,
        });
        return;
      }
      if (event.action === "member_history_read") {
        await appendWalletReadAudit(tx, {
          action: "WALLET_MEMBER_HISTORY_READ",
          accountId: event.accountId,
        });
      }
    });
  }
}
