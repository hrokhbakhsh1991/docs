/**
 * Host-owned outbox writer contract for finance ledger capture events.
 * Structurally compatible with Denali OutboxWriter; host implementation is TX-scoped.
 * @returns true when a new outbox row was inserted; false on duplicate domainEventId.
 */
export type FinanceLedgerOutboxEnqueueInput = {
  readonly tenantId: string;
  readonly aggregateType: "FinanceLedger";
  readonly aggregateId: string;
  readonly eventType: "finance.ledger.double_entry_applied";
  readonly domainEventId: string;
  readonly payload: {
    readonly entityType: "finance_ledger_journal";
    readonly registrationId: string;
    readonly journalId: string;
    readonly lines: ReadonlyArray<{
      readonly id: string;
      readonly journalId: string;
      readonly tenantId: string;
      readonly account: string;
      readonly side: "debit" | "credit";
      readonly amount_minor: string;
      readonly currency: string;
      readonly correlationId: string;
      readonly idempotencyKey: string;
      readonly createdAt: string;
      readonly reversesLineId?: string;
      readonly metadata?: Record<string, unknown>;
    }>;
  };
};

export interface FinanceOutboxWriter {
  addEvent(event: FinanceLedgerOutboxEnqueueInput): Promise<boolean>;
}
