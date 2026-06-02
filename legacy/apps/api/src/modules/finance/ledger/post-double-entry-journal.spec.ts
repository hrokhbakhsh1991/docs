import assert from "node:assert/strict";
import test from "node:test";
import {
  postDoubleEntryJournal,
  postDoubleEntryReversalJournal,
} from "./post-double-entry-journal";
import { LEDGER_ACCOUNTS } from "./ledger-accounts";

const base = {
  tenantId: "t1",
  currency: "IRR",
  correlationId: "corr-base",
  idempotencyKey: "idem-base",
};

test("postDoubleEntryJournal rejects blank idempotency key", () => {
  assert.throws(
    () =>
      postDoubleEntryJournal({
        tenantId: "t1",
        debitAccount: "a",
        creditAccount: "b",
        amount_minor: "1",
        currency: "USD",
        correlationId: "c1",
        idempotencyKey: "   "
      }),
    /LEDGER_IDEMPOTENCY_KEY_REQUIRED/
  );
});

test("postDoubleEntryJournal rejects same debit and credit account", () => {
  assert.throws(
    () =>
      postDoubleEntryJournal({
        tenantId: "t1",
        debitAccount: "same",
        creditAccount: "same",
        amount_minor: "10",
        currency: "USD",
        correlationId: "c1",
        idempotencyKey: "j1"
      }),
    /LEDGER_ACCOUNTS_DISTINCT/
  );
});

test("postDoubleEntryJournal rejects non-positive amount", () => {
  assert.throws(
    () =>
      postDoubleEntryJournal({
        tenantId: "t1",
        debitAccount: "a",
        creditAccount: "b",
        amount_minor: "0",
        currency: "USD",
        correlationId: "c1",
        idempotencyKey: "j1"
      }),
    /LEDGER_AMOUNT_POSITIVE/
  );
});

test("postDoubleEntryJournal returns balanced two-line journal with shared journalId", () => {
  const { journalId, lines } = postDoubleEntryJournal({
    tenantId: "t1",
    debitAccount: "gl:clearing",
    creditAccount: "booking:r1",
    amount_minor: "500",
    currency: "IRR",
    correlationId: "corr",
    idempotencyKey: "pay-1"
  });
  assert.equal(lines.length, 2);
  assert.equal(lines[0]!.journalId, journalId);
  assert.equal(lines[1]!.journalId, journalId);
  assert.equal(lines[0]!.side, "debit");
  assert.equal(lines[1]!.side, "credit");
  assert.equal(lines[0]!.account, "gl:clearing");
  assert.equal(lines[1]!.account, "booking:r1");
  assert.equal(lines[0]!.amount_minor, "500");
  assert.equal(lines[1]!.amount_minor, "500");
  assert.match(lines[0]!.idempotencyKey, /:debit$/);
  assert.match(lines[1]!.idempotencyKey, /:credit$/);
});

test("postDoubleEntryJournal returns frozen lines (append-only in-memory contract)", () => {
  const full = postDoubleEntryJournal({
    tenantId: "t1",
    debitAccount: "gl:clearing",
    creditAccount: "booking:r1",
    amount_minor: "500",
    currency: "IRR",
    correlationId: "corr",
    idempotencyKey: "pay-freeze"
  });
  assert.ok(Object.isFrozen(full));
  const { lines } = full;
  assert.ok(Object.isFrozen(lines));
  assert.ok(Object.isFrozen(lines[0]));
  assert.ok(Object.isFrozen(lines[1]));
  assert.throws(() => {
    (lines[0] as { amount_minor: string }).amount_minor = "999";
  }, /Cannot assign|read only|read-only/i);
  assert.throws(() => {
    (lines as unknown as { push: (_x: unknown) => void }).push({});
  }, /Cannot|read only|read-only|not extensible/i);
});

test("postDoubleEntryJournal accepts stableJournalAndLineIds and journalLinesCreatedAtIso", () => {
  const stable = {
    journalId: "11111111-1111-4111-8111-111111111111",
    debitLineId: "22222222-2222-4222-8222-222222222222",
    creditLineId: "33333333-3333-4333-8333-333333333333"
  };
  const { journalId, lines } = postDoubleEntryJournal({
    tenantId: "t1",
    debitAccount: "gl:clearing",
    creditAccount: "booking:r1",
    amount_minor: "1",
    currency: "IRR",
    correlationId: "corr",
    idempotencyKey: "pay-stable",
    stableJournalAndLineIds: stable,
    journalLinesCreatedAtIso: "2026-02-01T00:00:00.000Z"
  });
  assert.equal(journalId, stable.journalId);
  assert.equal(lines[0]!.id, stable.debitLineId);
  assert.equal(lines[1]!.id, stable.creditLineId);
  assert.equal(lines[0]!.createdAt, "2026-02-01T00:00:00.000Z");
  assert.equal(lines[1]!.createdAt, "2026-02-01T00:00:00.000Z");
});


/* merged from post-double-entry-reversal-journal.spec.ts */

test("postDoubleEntryReversalJournal negates original and sets reversesLineId on both legs", () => {
  const { lines: orig } = postDoubleEntryJournal({
    ...base,
    debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
    creditAccount: "booking:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    amount_minor: "5000"
  });
  const { lines: rev } = postDoubleEntryReversalJournal({
    tenantId: base.tenantId,
    originalLines: orig,
    correlationId: "corr-refund",
    idempotencyKey: "idem-refund"
  });
  const [rDebit, rCredit] = rev;
  assert.equal(rDebit.side, "debit");
  assert.equal(rCredit.side, "credit");
  assert.equal(rDebit.account, orig[1]!.account);
  assert.equal(rCredit.account, orig[0]!.account);
  assert.equal(rDebit.reversesLineId, orig[1]!.id);
  assert.equal(rCredit.reversesLineId, orig[0]!.id);
  assert.notEqual(rDebit.journalId, orig[0]!.journalId);
});

test("postDoubleEntryReversalJournal rejects wrong line order", () => {
  const { lines: orig } = postDoubleEntryJournal({
    ...base,
    debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
    creditAccount: "booking:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    amount_minor: "1"
  });
  assert.throws(
    () =>
      postDoubleEntryReversalJournal({
        tenantId: base.tenantId,
        originalLines: [orig[1]!, orig[0]!],
        correlationId: "c",
        idempotencyKey: "k"
      }),
    /LEDGER_REVERSAL_ORDER/
  );
});
