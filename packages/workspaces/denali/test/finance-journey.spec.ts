/**
 * Phase 2 — Denali finance operator confidence journey (package scope).
 * TourCreated → consume → ledger visible; duplicate / incomplete / writer failure.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_FINANCE_OPS_MANIFEST,
  buildDenaliTourCreatedFinancePayload,
  createDenaliFinanceOutboxConsumer,
  resolveDenaliRegistrationObligationMinor,
  verifyDenaliTourCreatedFinanceChain,
} from "../src/finance/index.ts";
import type { DenaliOutboxDomainEvent, OutboxWriter } from "../src/finance/index.ts";

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const registrationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const tourId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const domainEventId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function tourCreatedEvent(
  overrides?: Partial<DenaliOutboxDomainEvent>
): DenaliOutboxDomainEvent {
  return {
    tenantId,
    domainEventId,
    eventType: "TourCreated",
    aggregateType: "Tour",
    aggregateId: tourId,
    payload: {
      tourId,
      registrationId,
      paidAmountMinor: "5000000",
      currency: "IRR",
    },
    ...overrides,
  };
}

describe("finance-journey.spec.ts — Denali Phase 2", () => {
  it("DN-F2-J01 obligation → TourCreated payload → ledger visible", async () => {
    const built = buildDenaliTourCreatedFinancePayload({
      tourId,
      registrationId,
      partySize: 2,
      tourCanonical: {
        pricing: {
          basePricePerPerson: 2_500_000,
          paymentMode: "offline_receipt",
        },
      },
    });
    assert.ok(built.obligation !== null);
    assert.equal(built.obligation.obligationMinor, "5000000");
    assert.ok(built.payload !== null);

    const chain = await verifyDenaliTourCreatedFinanceChain({
      events: [
        tourCreatedEvent({
          payload: built.payload!,
        }),
      ],
    });

    assert.equal(chain.consumer.handled, 1);
    assert.equal(chain.processed, true);
    assert.equal(chain.visibility.ledgerVisible, true);
    assert.equal(chain.visibility.panelLedgerEnabled, true);
    assert.equal(chain.ledgerEvents.length, 1);
    assert.equal(chain.ledgerEvents[0]?.eventType, "finance.ledger.double_entry_applied");
    assert.equal(chain.ledgerEvents[0]?.payload.registrationId, registrationId);
    assert.equal(DEFAULT_FINANCE_OPS_MANIFEST.panels.ledger, true);
  });

  it("DN-F2-J02 duplicate domainEventId does not double-post ledger", async () => {
    const event = tourCreatedEvent();
    const readerEvents = [event];
    let readCount = 0;
    const ledgerEvents: unknown[] = [];
    const writer: OutboxWriter = {
      async addEvent(row) {
        ledgerEvents.push(row);
        return true;
      },
    };
    const consumer = createDenaliFinanceOutboxConsumer({
      reader: {
        async readPending() {
          readCount += 1;
          return readCount === 1 ? readerEvents : readerEvents;
        },
      },
      writer,
    });

    const first = await consumer.consumePending();
    const second = await consumer.consumePending();
    assert.equal(first.handled, 1);
    assert.equal(second.handled, 0);
    assert.equal(second.skipped, 1);
    assert.equal(ledgerEvents.length, 1);
  });

  it("DN-F2-J03 incomplete TourCreated payload is skipped (no ledger)", async () => {
    const chain = await verifyDenaliTourCreatedFinanceChain({
      events: [
        tourCreatedEvent({
          payload: { tourId, registrationId },
        }),
      ],
    });
    assert.equal(chain.consumer.handled, 0);
    assert.equal(chain.consumer.skipped, 1);
    assert.equal(chain.visibility.ledgerVisible, false);
    assert.equal(chain.ledgerEvents.length, 0);
    // Incomplete TourCreated is skipped without marking processed (retryable).
    assert.equal(chain.processed, false);
  });

  it("DN-F2-J04 writer failure does not mark event processed", async () => {
    const failingWriter: OutboxWriter = {
      async addEvent() {
        throw new Error("OUTBOX_WRITE_FAILED");
      },
    };
    const consumer = createDenaliFinanceOutboxConsumer({
      reader: {
        async readPending() {
          return [tourCreatedEvent()];
        },
      },
      writer: failingWriter,
    });
    await assert.rejects(() => consumer.consumePending(), /OUTBOX_WRITE_FAILED/);
    assert.equal(await consumer.hasProcessed(domainEventId), false);
  });

  it("DN-F2-J05 ledger panel disabled → journal exists but not operator-visible", async () => {
    const chain = await verifyDenaliTourCreatedFinanceChain({
      events: [tourCreatedEvent()],
      opsManifest: {
        ...DEFAULT_FINANCE_OPS_MANIFEST,
        panels: { ...DEFAULT_FINANCE_OPS_MANIFEST.panels, ledger: false },
      },
    });
    assert.equal(chain.ledgerEvents.length, 1);
    assert.equal(chain.visibility.panelLedgerEnabled, false);
    assert.equal(chain.visibility.ledgerVisible, false);
  });

  it("DN-F2-J06 non-offline paymentMode yields no finance payload", () => {
    const built = buildDenaliTourCreatedFinancePayload({
      tourId,
      registrationId,
      partySize: 1,
      tourCanonical: {
        pricing: { basePricePerPerson: 1000, paymentMode: "gateway" },
      },
    });
    assert.equal(built.obligation, null);
    assert.equal(built.payload, null);
    assert.equal(
      resolveDenaliRegistrationObligationMinor({
        tourCanonical: { pricing: { basePricePerPerson: 1000, paymentMode: "gateway" } },
        partySize: 1,
      }),
      null
    );
  });
});
