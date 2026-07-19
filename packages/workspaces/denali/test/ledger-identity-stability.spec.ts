/**
 * Adapter identity stability — payment capture + TourCreated ledger (Denali).
 * Business domainEventId formulas unchanged; journal/line ids must be deterministic.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DenaliFinanceLedgerPolicyAdapter } from "../src/finance/adapters/denali-finance-ledger-policy.adapter";
import {
  emitFinanceLedgerDoubleEntryAppliedOutbox,
} from "../src/finance/emit-finance-ledger-journal-outbox";
import { handleTourCreatedLedgerEvent } from "../src/finance/handlers/tour-created-ledger";
import {
  postDoubleEntryJournal,
  stableLedgerIdentifiersFromSeed,
} from "../src/finance/post-double-entry-journal";
import type { OutboxWriter } from "../src/finance/outbox-writer.port";

const paymentId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const registrationId = "11111111-2222-4333-8444-555555555555";
const tenantId = "99999999-aaaa-4bbb-8ccc-dddddddddddd";
const tourCreatedEvt = "tour-created-evt-stable-001";

describe("ledger identity stability (Denali)", () => {
  it("payment capture domainEventId + journal/lines are deterministic across rebuild", () => {
    const adapter = new DenaliFinanceLedgerPolicyAdapter();
    const input = {
      tenantId,
      paymentId,
      registrationId,
      amountMinor: "2500",
      currency: "USD",
      capturedAtIso: "2026-07-19T00:00:00.000Z",
    };
    const a = adapter.buildPaymentCaptureJournal(input);
    const b = adapter.buildPaymentCaptureJournal(input);
    assert.equal(a.domainEventId, `payment:${paymentId}:ledger-capture-anchor`);
    assert.equal(a.domainEventId, b.domainEventId);
    assert.equal(a.journalId, b.journalId);
    assert.equal(a.lines[0]!.id, b.lines[0]!.id);
    assert.equal(a.lines[1]!.id, b.lines[1]!.id);
  });

  it("prepayment ledger domainEventId uses caller ledgerDomainEventId (stable)", () => {
    const adapter = new DenaliFinanceLedgerPolicyAdapter();
    const ledgerDomainEventId = `prepayment:${registrationId}:keyhash:ledger`;
    const input = {
      tenantId,
      registrationId,
      amountMinor: "100",
      currency: "USD",
      method: "Manual",
      recordedAtIso: "2026-07-19T00:00:00.000Z",
      keyHash: "keyhash",
      prepaymentDomainEventId: `prepayment:${registrationId}:keyhash`,
      ledgerDomainEventId,
      journalSeed: ledgerDomainEventId,
    };
    const a = adapter.buildPrepaymentJournal(input);
    const b = adapter.buildPrepaymentJournal(input);
    assert.equal(a.domainEventId, ledgerDomainEventId);
    assert.equal(a.journalId, b.journalId);
    assert.deepEqual(
      a.lines.map((l) => l.id),
      b.lines.map((l) => l.id)
    );
  });

  it("TourCreated path: domainEventId and journal ids stable across retry", async () => {
    const events: Array<{ domainEventId: string; payload: { journalId: string; lines: Array<{ id: string }> } }> =
      [];
    const writer: OutboxWriter = {
      async addEvent(ev) {
        events.push(ev as (typeof events)[number]);
        return true;
      },
    };

    const row = {
      tenantId,
      domainEventId: tourCreatedEvt,
      eventType: "TourCreated",
      aggregateType: "tour",
      aggregateId: "tour-1",
      payload: {
        registrationId,
        paidAmountMinor: "500",
        currency: "USD",
      },
    };

    await handleTourCreatedLedgerEvent({ tenantId, event: row, outboxWriter: writer });
    await handleTourCreatedLedgerEvent({ tenantId, event: row, outboxWriter: writer });

    assert.equal(events.length, 2);
    assert.equal(events[0]!.domainEventId, events[1]!.domainEventId);
    assert.equal(events[0]!.payload.journalId, events[1]!.payload.journalId);
    assert.equal(events[0]!.payload.lines[0]!.id, events[1]!.payload.lines[0]!.id);
    assert.match(
      events[0]!.domainEventId,
      new RegExp(`^finance\\.ledger:${registrationId}:tour-created:${tourCreatedEvt}`)
    );
  });

  it("postDoubleEntryJournal rejects missing stable ids (no random fallback)", () => {
    assert.throws(
      () =>
        postDoubleEntryJournal({
          tenantId,
          debitAccount: "a",
          creditAccount: "b",
          amount_minor: "1",
          currency: "USD",
          correlationId: "c",
          idempotencyKey: "k",
          // @ts-expect-error intentional missing stable ids
          stableJournalAndLineIds: undefined,
        }),
      /LEDGER_STABLE_ID_REQUIRED/
    );
  });

  it("stableLedgerIdentifiersFromSeed is pure", () => {
    const a = stableLedgerIdentifiersFromSeed(tourCreatedEvt, "tour-created-ledger");
    const b = stableLedgerIdentifiersFromSeed(tourCreatedEvt, "tour-created-ledger");
    assert.deepEqual(a, b);
  });
});
