import type { WalletActor, WalletReference } from "../domain/types";

export type WalletAuditEvent = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly transactionId: string;
  readonly action:
    | "operator_credit"
    | "operator_debit"
    | "reversal"
    | "member_balance_read"
    | "member_history_read";
  readonly actor: WalletActor;
  readonly reference: WalletReference | null;
  readonly occurredAt: string;
};

export interface WalletAuditPort {
  record(event: WalletAuditEvent): Promise<void>;
}
