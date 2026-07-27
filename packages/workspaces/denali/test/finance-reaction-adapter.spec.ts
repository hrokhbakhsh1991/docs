/**
 * Phase 2 — DenaliTourCreatedFinanceReactionAdapter + host IO stubs.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DenaliTourCreatedFinanceReactionAdapter } from "../src/finance/adapters/denali-tour-created-finance-reaction.adapter.ts";
import type { DenaliFinanceProcessedStore } from "../src/finance/finance-outbox-consumer.ts";
import type { DenaliOutboxDomainEvent } from "../src/finance/outbox-reader.port.ts";
import type {
  FinanceLedgerOutboxEnqueueInput,
  OutboxWriter,
} from "../src/finance/outbox-writer.port.ts";

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const registrationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const tourId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const domainEventId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function createHostStub(pending: DenaliOutboxDomainEvent[]) {
  const ledgerEvents: FinanceLedgerOutboxEnqueueInput[] = [];
  const failures: string[] = [];
  const claimed = new Set<string>();
  const processed = new Set<string>();

  const writer: OutboxWriter = {
    async addEvent(event) {
      ledgerEvents.push(event);
      return true;
    },
  };

  const processedStore: DenaliFinanceProcessedStore = {
    hasProcessed(id) {
      return processed.has(id);
    },
    markProcessed(id) {
      processed.add(id);
    },
  };

  const adapter = new DenaliTourCreatedFinanceReactionAdapter({
    createOutboxReader: () => ({
      async readPending() {
        return pending;
      },
    }),
    createOutboxWriter: () => writer,
    createProcessedStore: () => processedStore,
    tryClaimProcessedEvent: async (_tenant, id) => {
      if (claimed.has(id)) {
        return false;
      }
      claimed.add(id);
      return true;
    },
    logReactionFailed: (input) => {
      failures.push(input.message);
    },
  });

  return { adapter, ledgerEvents, failures, claimed, processed };
}

describe("finance-reaction-adapter.spec.ts — Denali Phase 2", () => {
  it("DN-F2-A01 consumePendingForTenant handles TourCreated and posts ledger", async () => {
    const pending: DenaliOutboxDomainEvent[] = [
      {
        tenantId,
        domainEventId,
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: tourId,
        payload: {
          tourId,
          registrationId,
          paidAmountMinor: "100",
          currency: "USD",
        },
      },
    ];
    const { adapter, ledgerEvents, failures } = createHostStub(pending);

    const batch = await adapter.consumePendingForTenant(tenantId);
    assert.equal(batch.handled, 1);
    assert.equal(batch.skipped, 0);
    assert.equal(ledgerEvents.length, 1);
    assert.equal(ledgerEvents[0]?.eventType, "finance.ledger.double_entry_applied");
    assert.equal(ledgerEvents[0]?.payload.registrationId, registrationId);
    assert.deepEqual(failures, []);
  });

  it("DN-F2-A02 reactToPublishedRow is claim-idempotent", async () => {
    const { adapter, ledgerEvents, failures } = createHostStub([]);

    const row = {
      tenantId,
      domainEventId,
      eventType: "TourCreated",
      aggregateType: "Tour",
      aggregateId: tourId,
      payload: {
        tourId,
        registrationId,
        paidAmountMinor: "250",
        currency: "IRR",
      },
    };

    assert.equal(await adapter.reactToPublishedRow(row), true);
    assert.equal(ledgerEvents.length, 1);
    assert.equal(await adapter.reactToPublishedRow(row), false);
    assert.equal(ledgerEvents.length, 1);
    assert.deepEqual(failures, []);
  });

  it("DN-F2-A03 reactToPublishedRow logs failure and returns false when writer throws", async () => {
    const failures: string[] = [];
    const claimed = new Set<string>();
    const adapter = new DenaliTourCreatedFinanceReactionAdapter({
      createOutboxReader: () => ({
        async readPending() {
          return [];
        },
      }),
      createOutboxWriter: () => ({
        async addEvent() {
          throw new Error("OUTBOX_WRITE_FAILED");
        },
      }),
      createProcessedStore: () => ({
        hasProcessed: () => false,
        markProcessed: () => undefined,
      }),
      tryClaimProcessedEvent: async (_tenant, id) => {
        if (claimed.has(id)) {
          return false;
        }
        claimed.add(id);
        return true;
      },
      logReactionFailed: (input) => {
        failures.push(input.message);
      },
    });

    const ok = await adapter.reactToPublishedRow({
      tenantId,
      domainEventId: "11111111-1111-4111-8111-111111111111",
      eventType: "TourCreated",
      aggregateType: "Tour",
      aggregateId: tourId,
      payload: {
        tourId,
        registrationId,
        paidAmountMinor: "10",
        currency: "USD",
      },
    });
    assert.equal(ok, false);
    assert.equal(failures.length, 1);
    assert.match(failures[0] ?? "", /OUTBOX_WRITE_FAILED/);
  });
});
