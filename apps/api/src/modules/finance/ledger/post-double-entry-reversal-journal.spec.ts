import assert from "node:assert/strict";
import test from "node:test";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "./ledger-accounts";
import { postDoubleEntryJournal, postDoubleEntryReversalJournal } from "./post-double-entry-journal";

const base = {
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  currency: "USD",
  correlationId: "corr-1",
  idempotencyKey: "idem-1"
};

test("postDoubleEntryReversalJournal negates original and sets reversesLineId on both legs", () => {
  const { lines: orig } = postDoubleEntryJournal({
    ...base,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
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
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
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
