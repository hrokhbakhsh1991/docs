import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  createDenaliFinanceOutboxConsumer,
  emitFinanceLedgerDoubleEntryAppliedOutbox,
  LEDGER_ACCOUNTS,
  bookingWalletId,
  postDoubleEntryJournal,
} from "../src/finance";
import type {
  DenaliOutboxDomainEvent,
  FinanceLedgerOutboxEnqueueInput,
  OutboxReader,
  OutboxWriter,
} from "../src/finance";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const regId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const tourId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const domainEventId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function tourCreatedFixture(overrides?: Partial<DenaliOutboxDomainEvent>): DenaliOutboxDomainEvent {
  return {
    tenantId: tenantA,
    domainEventId,
    eventType: "TourCreated",
    aggregateType: "Tour",
    aggregateId: tourId,
    payload: {
      tourId,
      registrationId: regId,
      paidAmountMinor: "100",
      currency: "USD",
    },
    ...overrides,
  };
}

function createRecordingWriter(): {
  writer: OutboxWriter;
  events: FinanceLedgerOutboxEnqueueInput[];
} {
  const events: FinanceLedgerOutboxEnqueueInput[] = [];
  return {
    events,
    writer: {
      async addEvent(event) {
        events.push(event);
        return true;
      },
    },
  };
}

describe("finance-outbox-consumer.spec.ts (REQ-P6-011, REQ-P6-012, REQ-P6-028)", () => {
  it("REQ-P6-011: trunk apps/api has no modules/finance directory", () => {
    assert.equal(existsSync(join(REPO_ROOT, "apps", "api", "src", "modules", "finance")), false);
    assert.equal(
      existsSync(join(REPO_ROOT, "apps", "api", "src", "modules", "finance", "denali")),
      false
    );
  });

  it("REQ-P6-012: emitFinanceLedgerDoubleEntryAppliedOutbox enqueues when tenant envelope matches lines", async () => {
    const { lines } = postDoubleEntryJournal({
      tenantId: tenantA,
      debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
      creditAccount: bookingWalletId(regId),
      amount_minor: "100",
      currency: "USD",
      correlationId: "corr",
      idempotencyKey: "idem-1",
      stableJournalAndLineIds: {
        journalId: "11111111-1111-4111-8111-111111111111",
        debitLineId: "22222222-2222-4222-8222-222222222222",
        creditLineId: "33333333-3333-4333-8333-333333333333",
      },
    });
    const { writer, events } = createRecordingWriter();

    await emitFinanceLedgerDoubleEntryAppliedOutbox({
      outboxWriter: writer,
      tenantId: tenantA,
      registrationId: regId,
      lines,
    });

    assert.equal(events.length, 1);
    const ev = events[0]!;
    assert.equal(ev.tenantId, tenantA);
    assert.equal(ev.eventType, "finance.ledger.double_entry_applied");
    assert.equal(
      ev.payload.lines.every((line) => line.tenantId === tenantA),
      true
    );
  });

  it("REQ-P6-012: emitFinanceLedgerDoubleEntryAppliedOutbox rejects cross-tenant line batch", async () => {
    const { lines } = postDoubleEntryJournal({
      tenantId: tenantA,
      debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
      creditAccount: bookingWalletId(regId),
      amount_minor: "100",
      currency: "USD",
      correlationId: "corr",
      idempotencyKey: "idem-2",
      stableJournalAndLineIds: {
        journalId: "44444444-4444-4444-8444-444444444444",
        debitLineId: "55555555-5555-4555-8555-555555555555",
        creditLineId: "66666666-6666-4666-8666-666666666666",
      },
    });
    let addCalls = 0;
    const writer: OutboxWriter = {
      async addEvent() {
        addCalls += 1;
        return true;
      },
    };

    await assert.rejects(
      () =>
        emitFinanceLedgerDoubleEntryAppliedOutbox({
          outboxWriter: writer,
          tenantId: tenantB,
          registrationId: regId,
          lines,
        }),
      /FINANCE_LEDGER_TENANT_MISMATCH/
    );
    assert.equal(addCalls, 0);
  });

  it("REQ-P6-028: stub OutboxReader delivers TourCreated fixture and handler enqueues ledger outbox", async () => {
    const fixture = tourCreatedFixture();
    const reader: OutboxReader = {
      async readPending() {
        return [fixture];
      },
    };
    const { writer, events } = createRecordingWriter();
    const consumer = createDenaliFinanceOutboxConsumer({ reader, writer });

    const result = await consumer.consumePending();

    assert.equal(result.handled, 1);
    assert.equal(result.skipped, 0);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.payload.registrationId, regId);
    assert.equal(await consumer.hasProcessed(domainEventId), true);
  });

  it("REQ-P6-012: idempotent replay of same domainEventId is a no-op", async () => {
    const fixture = tourCreatedFixture();
    const reader: OutboxReader = {
      async readPending() {
        return [fixture];
      },
    };
    const { writer, events } = createRecordingWriter();
    const consumer = createDenaliFinanceOutboxConsumer({ reader, writer });

    await consumer.consumePending();
    assert.equal(events.length, 1);

    const replay = await consumer.consumePending();
    assert.equal(replay.handled, 0);
    assert.equal(replay.skipped, 1);
    assert.equal(events.length, 1);
  });
});
