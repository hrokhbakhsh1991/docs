import type {
  WorkspaceFinanceEventReactionPort,
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "@app-tour/finance-http-contracts";

export class AlpineTourCreatedFinanceReactionAdapter implements WorkspaceFinanceEventReactionPort {
  readonly handledDomainEventIds: string[] = [];

  async consumePendingForTenant(_tenantId: string): Promise<WorkspaceFinanceReactionBatchResult> {
    return { handled: 0, skipped: 0 };
  }

  async reactToPublishedRow(row: WorkspaceFinancePublishedOutboxRow): Promise<boolean> {
    if (row.eventType !== "TourCreated" || (row.aggregateId?.trim() ?? "").length === 0) {
      return false;
    }
    this.handledDomainEventIds.push(row.domainEventId);
    return true;
  }
}
