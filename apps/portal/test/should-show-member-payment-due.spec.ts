import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowMemberPaymentDue } from "../src/me/should-show-member-payment-due";

const base = {
  registrationStatus: "approved" as const,
  paymentCollection: "offline" as const,
  paymentStatus: "unpaid",
  paymentDueAt: "2026-09-28T12:00:00.000Z",
};

test("shows a deadline only for an open approved payment obligation", () => {
  assert.equal(shouldShowMemberPaymentDue(base), true);
});

test("hides stale deadlines after paid or waived projection", () => {
  assert.equal(shouldShowMemberPaymentDue({ ...base, paymentStatus: "paid" }), false);
  assert.equal(shouldShowMemberPaymentDue({ ...base, financialDisplayState: "WAIVED" }), false);
});

test("hides deadlines for free, pending, waitlisted, and closed registrations", () => {
  assert.equal(shouldShowMemberPaymentDue({ ...base, paymentCollection: "free" }), false);
  assert.equal(shouldShowMemberPaymentDue({ ...base, registrationStatus: "pending" }), false);
  assert.equal(shouldShowMemberPaymentDue({ ...base, registrationStatus: "waitlisted" }), false);
  assert.equal(shouldShowMemberPaymentDue({ ...base, registrationStatus: "cancelled" }), false);
});
