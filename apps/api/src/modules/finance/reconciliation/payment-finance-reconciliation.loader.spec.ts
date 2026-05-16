import assert from "node:assert/strict";
import test from "node:test";
import { OutboxEventEntity } from "../../../common/outbox/entities/outbox-event.entity";
import {
  ledgerLinesFromFinanceOutboxRows,
  paymentAmountToMinorString,
  tryParseLedgerJournalLine
} from "./payment-finance-reconciliation.loader";

test("paymentAmountToMinorString normalizes integer-like decimals and trims", () => {
  assert.equal(paymentAmountToMinorString("100.00"), "100");
  assert.equal(paymentAmountToMinorString(" 42 "), "42");
  assert.equal(paymentAmountToMinorString("100.50"), "100.50");
});

test("tryParseLedgerJournalLine fills tenantId from fallback when payload tenant is blank", () => {
  const fallback = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const line = tryParseLedgerJournalLine(
    {
      id: "l1",
      journalId: "j1",
      tenantId: "",
      account: "cash",
      side: "debit",
      amount_minor: "1",
      currency: "USD",
      correlationId: "c1",
      idempotencyKey: "i1",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    fallback
  );
  assert.ok(line);
  assert.equal(line?.tenantId, fallback);
});

test("ledgerLinesFromFinanceOutboxRows ignores wrong event types and invalid line rows", () => {
  const tenant = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const finance = {
    eventType: "finance.ledger.double_entry_applied",
    payload: {
      lines: [
        {
          id: "l1",
          journalId: "j1",
          account: "a",
          side: "credit",
          amount_minor: "5",
          currency: "EUR",
          correlationId: "c",
          idempotencyKey: "k",
          createdAt: "2026-01-01T00:00:00.000Z"
        },
        { id: "bad" }
      ]
    }
  } as unknown as OutboxEventEntity;
  const other = {
    eventType: "payment.succeeded",
    payload: { lines: [] }
  } as unknown as OutboxEventEntity;
  const lines = ledgerLinesFromFinanceOutboxRows([other, finance], tenant);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.id, "l1");
  assert.equal(lines[0]?.tenantId, tenant);
});
