import assert from "node:assert/strict";
import test from "node:test";
import { BookingStatus } from "./booking-status";
import { assertValidBookingTransition, BookingTransitionForbiddenError } from "./assert-valid-booking-transition";
import { canTransition } from "./booking-transition-rules";

test("canTransition allows listed edges", () => {
  assert.equal(canTransition(BookingStatus.PENDING, BookingStatus.AWAITING_PAYMENT), true);
  assert.equal(canTransition(BookingStatus.CONFIRMED, BookingStatus.REFUNDED), true);
});

test("canTransition rejects illegal edges", () => {
  assert.equal(canTransition(BookingStatus.REFUNDED, BookingStatus.PENDING), false);
  assert.equal(canTransition(BookingStatus.CONFIRMED, BookingStatus.PENDING), false);
});

test("assertValidBookingTransition throws on illegal move", () => {
  assert.throws(
    () => assertValidBookingTransition(BookingStatus.REFUNDED, BookingStatus.CONFIRMED),
    (e) => e instanceof BookingTransitionForbiddenError
  );
});

test("assertValidBookingTransition allows no-op same state", () => {
  assert.doesNotThrow(() => assertValidBookingTransition(BookingStatus.CONFIRMED, BookingStatus.CONFIRMED));
});
