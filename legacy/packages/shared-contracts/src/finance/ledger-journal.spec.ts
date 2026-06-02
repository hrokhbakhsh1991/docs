import assert from "node:assert/strict";
import test from "node:test";

import {
  assertLedgerJournalDoubleEntry,
  bookingLedgerAccountId,
  findLedgerJournalBalanceViolations,
  LEDGER_ACCOUNTS,
  LedgerAccountIdSchema,
  LedgerJournalSchema,
  REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
} from "./finance.schemas";

const JOURNAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LINE_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LINE_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const REGISTRATION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

test("LedgerAccountIdSchema accepts LEDGER_ACCOUNTS and booking wallet", () => {
  assert.equal(
    LedgerAccountIdSchema.safeParse(REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT).success,
    true,
  );
  assert.equal(
    LedgerAccountIdSchema.safeParse(LEDGER_ACCOUNTS.DISCOUNT_ADJUSTMENTS).success,
    true,
  );
  assert.equal(
    LedgerAccountIdSchema.safeParse(bookingLedgerAccountId(REGISTRATION_ID)).success,
    true,
  );
  assert.equal(LedgerAccountIdSchema.safeParse("invalid-account").success, false);
});

test("findLedgerJournalBalanceViolations passes for balanced two-line journal", () => {
  const violations = findLedgerJournalBalanceViolations(
    [
      {
        journalId: JOURNAL_ID,
        tenantId: TENANT_ID,
        side: "debit",
        amountMinor: "5000",
        currency: "IRR",
      },
      {
        journalId: JOURNAL_ID,
        tenantId: TENANT_ID,
        side: "credit",
        amountMinor: "5000",
        currency: "IRR",
      },
    ],
    { journalId: JOURNAL_ID, tenantId: TENANT_ID },
  );
  assert.equal(violations.length, 0);
});

test("assertLedgerJournalDoubleEntry rejects debit/credit mismatch", () => {
  assert.throws(
    () =>
      assertLedgerJournalDoubleEntry([
        {
          journalId: JOURNAL_ID,
          tenantId: TENANT_ID,
          side: "debit",
          amountMinor: "100",
          currency: "USD",
        },
        {
          journalId: JOURNAL_ID,
          tenantId: TENANT_ID,
          side: "credit",
          amountMinor: "99",
          currency: "USD",
        },
      ]),
    /LEDGER_DOUBLE_ENTRY_INVALID/,
  );
});

test("LedgerJournalSchema validates balanced journal envelope", () => {
  const booking = bookingLedgerAccountId(REGISTRATION_ID);
  const parsed = LedgerJournalSchema.safeParse({
    journalId: JOURNAL_ID,
    tenantId: TENANT_ID,
    lines: [
      {
        id: LINE_A,
        journalId: JOURNAL_ID,
        tenantId: TENANT_ID,
        accountId: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
        side: "debit",
        amountMinor: "250000",
        currency: "irr",
        correlationId: "capture:debit",
        idempotencyKey: "capture:debit",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: LINE_B,
        journalId: JOURNAL_ID,
        tenantId: TENANT_ID,
        accountId: booking,
        side: "credit",
        amountMinor: "250000",
        currency: "IRR",
        correlationId: "capture:credit",
        idempotencyKey: "capture:credit",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.lines[0]?.currency, "IRR");
  }
});
