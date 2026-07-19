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
  emitPaidLedgerExclusive?: (input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly paidAmountMinor: string;
    readonly currency: string;
    readonly tourCreatedDomainEventId: string;
  }) => Promise<"emitted" | "skipped">;
}): DenaliFinanceOutboxConsumer {
  const memoryProcessed = new Set<string>();

  async function dispatchEvent(event: DenaliOutboxDomainEvent): Promise<boolean> {
    if (deps.emitPaidLedgerExclusive !== undefined && event.eventType === "TourCreated") {
      const payload = event.payload as TourCreatedLedgerPayload;
      const registrationId = payload.registrationId?.trim() ?? "";
      const paidAmountMinor = payload.paidAmountMinor?.trim() ?? "";
      if (!registrationId || !paidAmountMinor) {
        return false;
      }
      const exclusive = await deps.emitPaidLedgerExclusive({
        tenantId: event.tenantId,
        registrationId,
        paidAmountMinor,
        currency: payload.currency?.trim() || "USD",
        tourCreatedDomainEventId: event.domainEventId,
      });
      return exclusive === "emitted" || exclusive === "skipped";
    }
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

/**
 * Phase 1.7 Commit 1 — Denali-owned composition entry for TourCreated → finance ledger batch.
 * Host supplies IO ports only; must not call {@link createDenaliFinanceOutboxConsumer} directly.
 */
export async function consumeDenaliTourCreatedFinanceOutbox(deps: {
  reader: OutboxReader;
  writer: OutboxWriter;
  processedStore?: DenaliFinanceProcessedStore;
  emitPaidLedgerExclusive?: (input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly paidAmountMinor: string;
    readonly currency: string;
    readonly tourCreatedDomainEventId: string;
  }) => Promise<"emitted" | "skipped">;
}): Promise<FinanceOutboxConsumerResult> {
  return createDenaliFinanceOutboxConsumer(deps).consumePending();
}
