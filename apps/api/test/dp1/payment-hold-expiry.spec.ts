/**
 * DP1-E — payment hold expiry (S4, S5, S7, S13).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { registrationOccupiesSeat } from "@app-tour/tour-core";

import { peekOutboxByAggregateForTests } from "../../src/bookings/in-memory-bookings.repository.ts";
import {
  cancelBooking,
  createBooking,
  sumApprovedPartySizeByTourIds,
} from "../../src/bookings/create-bookings-service.ts";
import {
  DP1_TENANT_DENALI,
  DP1_TOUR_ID,
  dp1BookingBody,
  dp1CreateAndApprovePending,
  dp1GetBooking,
  dp1ListBookingsByStatus,
  dp1OpsAuth,
  requirePaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

async function expireHold(registrationId: string): Promise<void> {
  const mod = (await import("../../src/finance/payment-hold-expiry.ts")) as {
    expirePaymentHoldForRegistration(input: {
      tenantId: string;
      registrationId: string;
    }): Promise<void>;
  };
  assert.equal(typeof mod.expirePaymentHoldForRegistration, "function");
  await mod.expirePaymentHoldForRegistration({
    tenantId: DP1_TENANT_DENALI,
    registrationId,
  });
}

describe("DP1-E payment hold expiry", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("S4: expiry without payment → cancelled + hold expired", async () => {
    const { bookingId } = await dp1CreateAndApprovePending({ partySize: 2 });
    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, bookingId, "2030-01-01T00:00:00.000Z");
    await expireHold(bookingId);

    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, bookingId);
    assert.equal(hold?.status, "expired");

    const booking = await dp1GetBooking(bookingId);
    assert.equal(booking.status, "cancelled");
    assert.equal(booking.cancelSource, "payment_deadline");
    assert.equal(booking.paymentStatus, "unpaid");

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: DP1_TENANT_DENALI,
      aggregateId: bookingId,
    });
    const types = outbox.map((row) => row.eventType);
    assert.ok(types.includes("payment.hold.expired"));
    assert.ok(types.includes("registration.cancelled"));
  });

  it("S5: expiry releases approved-unpaid occupancy", async () => {
    const { bookingId } = await dp1CreateAndApprovePending({ partySize: 3, tourCapacityMax: 10 });
    const before = await sumApprovedPartySizeByTourIds(DP1_TENANT_DENALI, [DP1_TOUR_ID]);
    assert.equal(before[DP1_TOUR_ID], 3);
    assert.equal(registrationOccupiesSeat("booking", "approved"), true);

    await expireHold(bookingId);
    const after = await sumApprovedPartySizeByTourIds(DP1_TENANT_DENALI, [DP1_TOUR_ID]);
    assert.equal(after[DP1_TOUR_ID] ?? 0, 0);
  });

  it("S7: expiry without waitlist does not promote", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    await expireHold(bookingId);
    const waitlisted = await dp1ListBookingsByStatus("approved");
    assert.equal(waitlisted.length, 0);
  });

  it("S13: operator cancel before payment closes hold without payment_deadline source", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    await cancelBooking(dp1OpsAuth(), bookingId);
    const booking = await dp1GetBooking(bookingId);
    assert.equal(booking.status, "cancelled");
    assert.notEqual(booking.cancelSource, "payment_deadline");
    const holdPort = await requirePaymentHoldPort();
    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, bookingId);
    assert.ok(hold === null || hold.status !== "open");
  });
});
