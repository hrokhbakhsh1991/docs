import assert from "node:assert/strict";
import test from "node:test";
import { BOOKING_CREATED_EVENT_TYPE } from "../../../src/common/events/booking-created.event";
import { isFinancialOutboxEventType } from "../../../src/common/audit/financial-outbox-event-types";

test("isFinancialOutboxEventType: known financial prefixes and booking.created", () => {
  assert.equal(isFinancialOutboxEventType(BOOKING_CREATED_EVENT_TYPE), true);
  assert.equal(isFinancialOutboxEventType("registration.payment_updated"), true);
  assert.equal(isFinancialOutboxEventType("finance.ledger.journal_posted"), true);
  assert.equal(isFinancialOutboxEventType("booking.finalization.phase"), true);
  assert.equal(isFinancialOutboxEventType("payment.created"), true);
});

test("isFinancialOutboxEventType: non-financial events", () => {
  assert.equal(isFinancialOutboxEventType("registration.accepted"), false);
  assert.equal(isFinancialOutboxEventType(""), false);
  assert.equal(isFinancialOutboxEventType("  "), false);
});
