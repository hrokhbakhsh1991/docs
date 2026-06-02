import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import {
  BookingFinalizationPhase,
  assertBookingFinalizationAtLeast,
  assertSingleStepBookingFinalizationAdvance,
  bookingFinalizationPhaseFromFacts,
  bookingFinalizationOutboxEventType
} from "./booking-finalization-pipeline";

test("phase derivation follows finance-tied ordering", () => {
  assert.equal(
    bookingFinalizationPhaseFromFacts({
      hasPriceSnapshot: false,
      hasPendingPayment: false,
      hasCapturedPayment: false,
      registrationFinanciallyConfirmed: false
    }),
    BookingFinalizationPhase.BOOKING_CREATED
  );
  assert.equal(
    bookingFinalizationPhaseFromFacts({
      hasPriceSnapshot: true,
      hasPendingPayment: false,
      hasCapturedPayment: false,
      registrationFinanciallyConfirmed: false
    }),
    BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED
  );
  assert.equal(
    bookingFinalizationPhaseFromFacts({
      hasPriceSnapshot: true,
      hasPendingPayment: true,
      hasCapturedPayment: false,
      registrationFinanciallyConfirmed: false
    }),
    BookingFinalizationPhase.PAYMENT_INITIATED
  );
  assert.equal(
    bookingFinalizationPhaseFromFacts({
      hasPriceSnapshot: true,
      hasPendingPayment: false,
      hasCapturedPayment: true,
      registrationFinanciallyConfirmed: false
    }),
    BookingFinalizationPhase.PAYMENT_CAPTURED
  );
  assert.equal(
    bookingFinalizationPhaseFromFacts({
      hasPriceSnapshot: true,
      hasPendingPayment: false,
      hasCapturedPayment: true,
      registrationFinanciallyConfirmed: true
    }),
    BookingFinalizationPhase.BOOKING_CONFIRMED
  );
});

test("assertBookingFinalizationAtLeast rejects skipped prerequisite", () => {
  assert.throws(
    () =>
      assertBookingFinalizationAtLeast(
        BookingFinalizationPhase.BOOKING_CREATED,
        BookingFinalizationPhase.PAYMENT_INITIATED,
        "createPaymentIntent"
      ),
    ConflictException
  );
  assertBookingFinalizationAtLeast(
    BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED,
    BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED,
    "createPaymentIntent"
  );
});

test("assertSingleStepBookingFinalizationAdvance rejects multi-step jump", () => {
  assert.throws(
    () =>
      assertSingleStepBookingFinalizationAdvance(
        BookingFinalizationPhase.BOOKING_CREATED,
        BookingFinalizationPhase.PAYMENT_INITIATED,
        "test"
      ),
    ConflictException
  );
  assertSingleStepBookingFinalizationAdvance(
    BookingFinalizationPhase.BOOKING_CREATED,
    BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED,
    "lock"
  );
});

test("outbox event types are stable per phase", () => {
  assert.match(bookingFinalizationOutboxEventType(BookingFinalizationPhase.BOOKING_CREATED), /^booking\.finalization\./);
});
