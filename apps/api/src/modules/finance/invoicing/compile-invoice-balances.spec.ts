import assert from "node:assert/strict";
import test from "node:test";
import { computePaidAndBalanceDueMinor } from "./compile-invoice-balances";
import {
  bookingWalletIdForRegistration,
  parseBookingIdFromWalletAccount,
} from "./parse-booking-wallet-id";

test("parseBookingIdFromWalletAccount extracts booking id", () => {
  const bookingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.equal(parseBookingIdFromWalletAccount(`booking:${bookingId}`), bookingId);
  assert.equal(bookingWalletIdForRegistration(bookingId), `booking:${bookingId}`);
});

test("parseBookingIdFromWalletAccount rejects invalid wallet accounts", () => {
  assert.throws(() => parseBookingIdFromWalletAccount("member:abc"), /INVALID_BOOKING_WALLET_ID/);
  assert.throws(() => parseBookingIdFromWalletAccount("booking:"), /INVALID_BOOKING_WALLET_ID/);
});

test("computePaidAndBalanceDueMinor caps paid at invoice total", () => {
  const result = computePaidAndBalanceDueMinor("1000", "1500");
  assert.equal(result.paidAmountMinor, "1000");
  assert.equal(result.balanceDueMinor, "0");
});

test("computePaidAndBalanceDueMinor computes remaining balance due", () => {
  const result = computePaidAndBalanceDueMinor("9999", "2500");
  assert.equal(result.paidAmountMinor, "2500");
  assert.equal(result.balanceDueMinor, "7499");
});

test("computePaidAndBalanceDueMinor treats negative wallet net as zero paid", () => {
  const result = computePaidAndBalanceDueMinor("5000", "-100");
  assert.equal(result.paidAmountMinor, "0");
  assert.equal(result.balanceDueMinor, "5000");
});
