/**
 * Finance-ws6 TourCreated → finance reaction fixture (no-op).
 */
import type {
  WorkspaceFinanceEventReactionPort,
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "@app-tour/finance-http-contracts";

export class FinanceWs6TourCreatedFinanceReactionAdapter implements WorkspaceFinanceEventReactionPort {
  async consumePendingForTenant(_tenantId: string): Promise<WorkspaceFinanceReactionBatchResult> {
    return { handled: 0, skipped: 0 };
  }

  async reactToPublishedRow(_row: WorkspaceFinancePublishedOutboxRow): Promise<boolean> {
    return false;
  }
}
