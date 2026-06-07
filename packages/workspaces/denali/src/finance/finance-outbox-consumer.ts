import {
  handleTourCreatedLedgerEvent,
  type TourCreatedLedgerPayload,
} from "./handlers/tour-created-ledger";
import type { DenaliOutboxDomainEvent, OutboxReader } from "./outbox-reader.port";
import type { OutboxWriter } from "./outbox-writer.port";

export type FinanceOutboxConsumerResult = {
  handled: number;
  skipped: number;
};

export type DenaliFinanceProcessedStore = {
  hasProcessed(domainEventId: string): boolean | Promise<boolean>;
  markProcessed(domainEventId: string): void | Promise<void>;
};

export type DenaliFinanceOutboxConsumer = {
  consumePending(): Promise<FinanceOutboxConsumerResult>;
  hasProcessed(domainEventId: string): boolean | Promise<boolean>;
};

async function resolveProcessed(
  store: DenaliFinanceProcessedStore | undefined,
  memoryProcessed: Set<string>,
  domainEventId: string
): Promise<boolean> {
  if (store !== undefined) {
    return Promise.resolve(store.hasProcessed(domainEventId));
  }
  return memoryProcessed.has(domainEventId);
}

async function recordProcessed(
  store: DenaliFinanceProcessedStore | undefined,
  memoryProcessed: Set<string>,
  domainEventId: string
): Promise<void> {
  if (store !== undefined) {
    await store.markProcessed(domainEventId);
    return;
  }
  memoryProcessed.add(domainEventId);
}

export function createDenaliFinanceOutboxConsumer(deps: {
  reader: OutboxReader;
  writer: OutboxWriter;
  processedStore?: DenaliFinanceProcessedStore;
}): DenaliFinanceOutboxConsumer {
  const memoryProcessed = new Set<string>();

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
        if (await resolveProcessed(deps.processedStore, memoryProcessed, event.domainEventId)) {
          skipped += 1;
          continue;
        }

        const payload = event.payload as TourCreatedLedgerPayload;
        const financePayload =
          event.eventType === "TourCreated" &&
          Boolean(payload.registrationId?.trim() && payload.paidAmountMinor?.trim());
        if (event.eventType === "TourCreated" && !financePayload) {
          skipped += 1;
          continue;
        }

        const didHandle = await dispatchEvent(event);
        await recordProcessed(deps.processedStore, memoryProcessed, event.domainEventId);
        if (didHandle) {
          handled += 1;
        } else {
          skipped += 1;
        }
      }

      return { handled, skipped };
    },
    hasProcessed(domainEventId: string): boolean | Promise<boolean> {
      return resolveProcessed(deps.processedStore, memoryProcessed, domainEventId);
    },
  };
}
