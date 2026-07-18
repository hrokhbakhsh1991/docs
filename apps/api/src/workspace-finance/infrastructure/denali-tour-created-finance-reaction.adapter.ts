/**
 * Denali workspace adapter — TourCreated → finance.ledger reaction (Phase 1.7 C2).
 * Wraps existing Denali consumer / side-effect runners; behavior and IDs unchanged.
 */
import {
  consumeDenaliTourCreatedFinanceOutbox,
  type DenaliOutboxDomainEvent,
  type OutboxReader,
  type OutboxWriter,
} from "@app-tour/workspace-denali";
import { runTourCreatedFinanceSideEffect } from "@app-tour/workspace-denali/host/finance/api-tour-created-adapter";

import { createWorkspaceOutboxReader } from "../prisma-workspace-outbox-reader";
import { createPrismaWorkspaceOutboxWriter } from "../prisma-workspace-outbox-writer";
import type {
  WorkspaceFinanceEventReactionPort,
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "../ports/workspace-finance-event-reaction.port";
import { createWorkspaceFinanceProcessedStore } from "../workspace-finance-processed-log";

function asDenaliOutboxReader(reader: ReturnType<typeof createWorkspaceOutboxReader>): OutboxReader {
  return {
    async readPending(): Promise<readonly DenaliOutboxDomainEvent[]> {
      const rows = await reader.readPending();
      return rows.map((row) => ({
        tenantId: row.tenantId,
        domainEventId: row.domainEventId,
        eventType: row.eventType,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        payload: row.payload,
      }));
    },
  };
}

export class DenaliTourCreatedFinanceReactionAdapter implements WorkspaceFinanceEventReactionPort {
  async consumePendingForTenant(tenantId: string): Promise<WorkspaceFinanceReactionBatchResult> {
    return consumeDenaliTourCreatedFinanceOutbox({
      reader: asDenaliOutboxReader(createWorkspaceOutboxReader(tenantId)),
      writer: createPrismaWorkspaceOutboxWriter() as OutboxWriter,
      processedStore: createWorkspaceFinanceProcessedStore(tenantId),
    });
  }

  async reactToPublishedRow(row: WorkspaceFinancePublishedOutboxRow): Promise<boolean> {
    return runTourCreatedFinanceSideEffect({
      tenantId: row.tenantId,
      domainEventId: row.domainEventId,
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      payload: row.payload,
    });
  }
}
