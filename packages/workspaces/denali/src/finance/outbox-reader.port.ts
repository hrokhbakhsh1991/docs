export type DenaliOutboxDomainEvent = {
  tenantId: string;
  domainEventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

export interface OutboxReader {
  readPending(): Promise<readonly DenaliOutboxDomainEvent[]>;
}
