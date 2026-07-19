/**
 * Denali workspace adapter — TourCreated → finance.ledger reaction (Phase 1.13).
 * Capability: `eventReactions: "durable-outbox"` (host IO, claim/idempotency, ledger side effects).
 * Host injects outbox IO; this module must not import apps/api Prisma helpers.
 * Production never uses the module-level side-effect deps registrar.
 */
import type {
  WorkspaceFinanceEventReactionPort,
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "@app-tour/finance-http-contracts";

import {
  runTourCreatedFinanceSideEffect,
  type TourCreatedFinanceSideEffectDeps,
} from "../api-tour-created-adapter";
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
  readonly tryClaimProcessedEvent: (
    tenantId: string,
    domainEventId: string
  ) => Promise<boolean>;
  readonly logReactionFailed: (input: {
    readonly tenantId: string;
    readonly domainEventId: string;
    readonly message: string;
  }) => void;
  /** Path B exclusive emit — skip when Path A/B wallet credit already exists. */
  readonly emitTourCreatedPaidLedgerExclusive?: (input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly paidAmountMinor: string;
    readonly currency: string;
    readonly tourCreatedDomainEventId: string;
  }) => Promise<"emitted" | "skipped">;
};

export class DenaliTourCreatedFinanceReactionAdapter implements WorkspaceFinanceEventReactionPort {
  constructor(private readonly hostIo: DenaliTourCreatedFinanceReactionHostIo) {}

  private sideEffectDeps(): TourCreatedFinanceSideEffectDeps {
    return {
      tryClaimProcessedEvent: this.hostIo.tryClaimProcessedEvent,
      createOutboxWriter: this.hostIo.createOutboxWriter,
      logTourCreatedFailed: this.hostIo.logReactionFailed,
      ...(this.hostIo.emitTourCreatedPaidLedgerExclusive !== undefined
        ? { emitPaidLedgerExclusive: this.hostIo.emitTourCreatedPaidLedgerExclusive }
        : {}),
    };
  }

  async consumePendingForTenant(tenantId: string): Promise<WorkspaceFinanceReactionBatchResult> {
    return consumeDenaliTourCreatedFinanceOutbox({
      reader: this.hostIo.createOutboxReader(tenantId),
      writer: this.hostIo.createOutboxWriter(),
      processedStore: this.hostIo.createProcessedStore(tenantId),
      ...(this.hostIo.emitTourCreatedPaidLedgerExclusive !== undefined
        ? { emitPaidLedgerExclusive: this.hostIo.emitTourCreatedPaidLedgerExclusive }
        : {}),
    });
  }

  async reactToPublishedRow(row: WorkspaceFinancePublishedOutboxRow): Promise<boolean> {
    return runTourCreatedFinanceSideEffect(
      {
        tenantId: row.tenantId,
        domainEventId: row.domainEventId,
        eventType: row.eventType,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        payload: row.payload,
      },
      this.sideEffectDeps()
    );
  }
}
