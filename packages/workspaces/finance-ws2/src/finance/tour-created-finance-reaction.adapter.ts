/**
 * Finance-ws2 TourCreated → finance reaction fixture (Phase 1.9 Event Ownership Closure).
 * Architecture proof: workspace can register an independent reaction via manifest/codegen
 * without editing apps/api hand Maps. No ledger side effects (fixture only).
 */
import type {
  WorkspaceFinanceEventReactionPort,
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "@app-tour/finance-http-contracts";

export class FinanceWs2TourCreatedFinanceReactionAdapter implements WorkspaceFinanceEventReactionPort {
  async consumePendingForTenant(_tenantId: string): Promise<WorkspaceFinanceReactionBatchResult> {
    return { handled: 0, skipped: 0 };
  }

  async reactToPublishedRow(_row: WorkspaceFinancePublishedOutboxRow): Promise<boolean> {
    return false;
  }
}
