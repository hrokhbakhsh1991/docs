export type FinanceLedgerOutboxEnqueueInput = {
  tenantId: string;
  aggregateType: "FinanceLedger";
  aggregateId: string;
  eventType: "finance.ledger.double_entry_applied";
  domainEventId: string;
  payload: {
    entityType: "finance_ledger_journal";
    registrationId: string;
    journalId: string;
    lines: Array<{
      id: string;
      journalId: string;
      tenantId: string;
      account: string;
      side: "debit" | "credit";
      amount_minor: string;
      currency: string;
      correlationId: string;
      idempotencyKey: string;
      createdAt: string;
      reversesLineId?: string;
      metadata?: Record<string, unknown>;
    }>;
  };
};

export interface OutboxWriter {
  /** @returns true when a new row was inserted; false on duplicate domainEventId. */
  addEvent(event: FinanceLedgerOutboxEnqueueInput): Promise<boolean>;
}
