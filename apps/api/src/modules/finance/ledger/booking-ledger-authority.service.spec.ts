import assert from "node:assert/strict";
import test from "node:test";
import type { OutboxService } from "../../outbox/outbox.service";
import { BookingLedgerAuthorityService, bookingWalletId } from "./booking-ledger-authority.service";
import type { BookingLedgerLeaderRegistrationRow } from "./contracts/leader-registration-payment-ledger.contracts";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "./ledger-accounts";
import { mockLedgerPersistEntityManager } from "./test/mock-ledger-entity-manager";
import {
  TEST_REGISTRATION_ID,
  TEST_TENANT_ID,
} from "../../../../test/helpers/finance-contract-fixtures";

function reg(overrides: Partial<BookingLedgerLeaderRegistrationRow> = {}): BookingLedgerLeaderRegistrationRow {
  return {
    id: TEST_REGISTRATION_ID,
    tenantId: TEST_TENANT_ID,
    paymentStatus: "NotPaid",
    quotedCurrencyCode: "IRR",
    ...overrides
  };
}

test("PAID with amount emits balanced journal and projects paid_amount", async () => {
  let outboxCalls = 0;
  const outbox: OutboxService = {
    async addEvent() {
      outboxCalls += 1;
    }
  } as unknown as OutboxService;
  const svc = new BookingLedgerAuthorityService(outbox);
  const registration = reg();
  const { ledgerFacts } = await svc.applyLeaderRegistrationPaymentMutation(
    mockLedgerPersistEntityManager(),
    registration,
    {
      paymentStatus: "Paid",
      paidAmount: 2500,
      expected_row_version: 1
    },
    "idem-1"
  );
  assert.equal(outboxCalls, 1);
  assert.equal(ledgerFacts.length, 2);
  const j0 = ledgerFacts[0]!.journalId;
  assert.equal(ledgerFacts[1]!.journalId, j0);
  const booking = bookingWalletId(TEST_REGISTRATION_ID);
  const debit = ledgerFacts.find((l) => l.side === "debit");
  const credit = ledgerFacts.find((l) => l.side === "credit");
  assert.equal(debit?.account, REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT);
  assert.equal(credit?.account, booking);
  assert.equal(debit?.amount_minor, "2500");
  assert.equal(credit?.amount_minor, "2500");
  assert.equal(registration.paidAmount, "2500");
  assert.equal(registration.paymentStatus, "Paid");
});

test("NOT_PAID emits reversal journal and clears projection when prior paid exists", async () => {
  let outboxCalls = 0;
  const outbox: OutboxService = {
    async addEvent() {
      outboxCalls += 1;
    }
  } as unknown as OutboxService;
  const svc = new BookingLedgerAuthorityService(outbox);
  const registration = reg({
    paymentStatus: "Paid",
    paidAmount: "100"
  });
  const { ledgerFacts } = await svc.applyLeaderRegistrationPaymentMutation(
    mockLedgerPersistEntityManager(),
    registration,
    {
      paymentStatus: "NotPaid",
      expected_row_version: 2
    },
    "idem-2"
  );
  assert.equal(outboxCalls, 1);
  assert.equal(ledgerFacts.length, 2);
  const booking = bookingWalletId(TEST_REGISTRATION_ID);
  const debit = ledgerFacts.find((l) => l.side === "debit");
  const credit = ledgerFacts.find((l) => l.side === "credit");
  assert.equal(debit?.account, booking);
  assert.equal(credit?.account, REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT);
  assert.equal(debit?.amount_minor, "100");
  assert.equal(registration.paidAmount, undefined);
  assert.equal(registration.paymentStatus, "NotPaid");
});

test("no journal lines skips outbox enqueue", async () => {
  let outboxCalls = 0;
  const outbox: OutboxService = {
    async addEvent() {
      outboxCalls += 1;
    }
  } as unknown as OutboxService;
  const svc = new BookingLedgerAuthorityService(outbox);
  const registration = reg();
  await svc.applyLeaderRegistrationPaymentMutation(
    mockLedgerPersistEntityManager(),
    registration,
    {
      paymentStatus: "Paid",
      expected_row_version: 1
    },
    "idem-no-amount"
  );
  assert.equal(outboxCalls, 0);
});
