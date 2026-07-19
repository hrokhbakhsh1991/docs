/**
 * Finance-ws5 TourCreated → finance reaction fixture.
 * Registers via manifest/codegen without apps/api hand Maps.
 */
import type {
  WorkspaceFinanceEventReactionPort,
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "@app-tour/finance-http-contracts";

export class FinanceWs5TourCreatedFinanceReactionAdapter implements WorkspaceFinanceEventReactionPort {
  async consumePendingForTenant(_tenantId: string): Promise<WorkspaceFinanceReactionBatchResult> {
    return { handled: 0, skipped: 0 };
  }

  async reactToPublishedRow(_row: WorkspaceFinancePublishedOutboxRow): Promise<boolean> {
    return false;
  }
}
