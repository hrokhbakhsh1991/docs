/**
 * Finance-ws5 TourCreated reaction — capability `eventReactions: "ack-only"`.
 *
 * Guarantees: TourCreated with a tour aggregate is acknowledged (returns true)
 * and recorded in-process. Does NOT claim durable outbox consume, processed-event
 * idempotency, or ledger/journal side effects (those are Denali `durable-outbox`).
 */
import type {
  WorkspaceFinanceEventReactionPort,
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "@app-tour/finance-http-contracts";

export class FinanceWs5TourCreatedFinanceReactionAdapter implements WorkspaceFinanceEventReactionPort {
  /** Ack-only observation log (same process; not durable across restarts). */
  readonly handledDomainEventIds: string[] = [];

  async consumePendingForTenant(_tenantId: string): Promise<WorkspaceFinanceReactionBatchResult> {
    // No host outbox IO — ack-only workspaces do not drain a durable finance outbox.
    return { handled: 0, skipped: 0 };
  }

  async reactToPublishedRow(row: WorkspaceFinancePublishedOutboxRow): Promise<boolean> {
    if (row.eventType !== "TourCreated") {
      return false;
    }
    const aggregateId = row.aggregateId?.trim() ?? "";
    if (aggregateId.length === 0) {
      return false;
    }
    this.handledDomainEventIds.push(row.domainEventId);
    return true;
  }
}
