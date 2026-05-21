import assert from "node:assert/strict";
import test from "node:test";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "./ledger-accounts";
import { postDoubleEntryJournal } from "./post-double-entry-journal";
import {
  findClearingZeroSumViolationsFromBalances,
  findClearingZeroSumViolationsFromLines,
  netClearingMinorByCurrencyFromLines
} from "./clearing-account-zero-sum";
import { bookingWalletId } from "./booking-ledger-authority.service";

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("balanced capture and reversal nets clearing account to zero", () => {
  const bookingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const { lines: capture } = postDoubleEntryJournal({
    tenantId,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingWalletId(bookingId),
    amount_minor: "5000",
    currency: "IRR",
    correlationId: "test:capture",
    idempotencyKey: "test:capture"
  });
  const { lines: reversal } = postDoubleEntryJournal({
    tenantId,
    debitAccount: bookingWalletId(bookingId),
    creditAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    amount_minor: "5000",
    currency: "IRR",
    correlationId: "test:refund",
    idempotencyKey: "test:refund"
  });
  const all = [...capture, ...reversal];
  assert.equal(netClearingMinorByCurrencyFromLines(tenantId, all).get("IRR"), 0n);
  assert.equal(findClearingZeroSumViolationsFromLines(tenantId, all).length, 0);
});

test("findClearingZeroSumViolationsFromBalances flags non-zero snapshot rows", () => {
  const v = findClearingZeroSumViolationsFromBalances([
    { currency: "USD", balanceMinor: "100" }
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0]!.currency, "USD");
});
