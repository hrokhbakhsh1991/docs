import { handleTourCreatedLedgerEvent } from "./handlers/tour-created-ledger";
import type { DenaliOutboxDomainEvent, OutboxReader } from "./outbox-reader.port";
import type { OutboxWriter } from "./outbox-writer.port";

export type FinanceOutboxConsumerResult = {
  handled: number;
  skipped: number;
};

export type DenaliFinanceOutboxConsumer = {
  consumePending(): Promise<FinanceOutboxConsumerResult>;
  hasProcessed(domainEventId: string): boolean;
};

export function createDenaliFinanceOutboxConsumer(deps: {
  reader: OutboxReader;
  writer: OutboxWriter;
}): DenaliFinanceOutboxConsumer {
  const processedDomainEventIds = new Set<string>();

  async function dispatchEvent(event: DenaliOutboxDomainEvent): Promise<boolean> {
    return handleTourCreatedLedgerEvent({
      tenantId: event.tenantId,
      event,
      outboxWriter: deps.writer,
    });
  }

  return {
    async consumePending(): Promise<FinanceOutboxConsumerResult> {
      const events = await deps.reader.readPending();
      let handled = 0;
      let skipped = 0;

      for (const event of events) {
        if (processedDomainEventIds.has(event.domainEventId)) {
          skipped += 1;
          continue;
        }

        const didHandle = await dispatchEvent(event);
        processedDomainEventIds.add(event.domainEventId);
        if (didHandle) {
          handled += 1;
        } else {
          skipped += 1;
        }
      }

      return { handled, skipped };
    },
    hasProcessed(domainEventId: string): boolean {
      return processedDomainEventIds.has(domainEventId);
    },
  };
}
