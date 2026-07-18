/**
 * Denali workspace adapter — TourCreated → finance.ledger reaction (Phase 1.9).
 * Host injects outbox IO; this module must not import apps/api Prisma helpers.
 */
import type {
  WorkspaceFinanceEventReactionPort,
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "@app-tour/finance-http-contracts";

import { runTourCreatedFinanceSideEffect } from "../api-tour-created-adapter";
import {
  consumeDenaliTourCreatedFinanceOutbox,
  type DenaliFinanceProcessedStore,
} from "../finance-outbox-consumer";
import type { OutboxReader } from "../outbox-reader.port";
import type { OutboxWriter } from "../outbox-writer.port";

export type DenaliTourCreatedFinanceReactionHostIo = {
  readonly createOutboxReader: (tenantId: string) => OutboxReader;
  readonly createOutboxWriter: () => OutboxWriter;
  readonly createProcessedStore: (tenantId: string) => DenaliFinanceProcessedStore;
};

export class DenaliTourCreatedFinanceReactionAdapter implements WorkspaceFinanceEventReactionPort {
  constructor(private readonly hostIo: DenaliTourCreatedFinanceReactionHostIo) {}

  async consumePendingForTenant(tenantId: string): Promise<WorkspaceFinanceReactionBatchResult> {
    return consumeDenaliTourCreatedFinanceOutbox({
      reader: this.hostIo.createOutboxReader(tenantId),
      writer: this.hostIo.createOutboxWriter(),
      processedStore: this.hostIo.createProcessedStore(tenantId),
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
