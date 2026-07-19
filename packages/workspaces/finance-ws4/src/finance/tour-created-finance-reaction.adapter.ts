/**
 * Finance-ws4 TourCreated → finance reaction fixture.
 * Architecture proof: workspace registers via manifest/codegen without editing apps/api hand Maps.
 */
import type {
  WorkspaceFinanceEventReactionPort,
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "@app-tour/finance-http-contracts";

export class FinanceWs4TourCreatedFinanceReactionAdapter implements WorkspaceFinanceEventReactionPort {
  async consumePendingForTenant(_tenantId: string): Promise<WorkspaceFinanceReactionBatchResult> {
    return { handled: 0, skipped: 0 };
  }

  async reactToPublishedRow(_row: WorkspaceFinancePublishedOutboxRow): Promise<boolean> {
    return false;
  }
}
