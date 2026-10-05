/**
 * DP1-F — duplicate expiry idempotency (S9, S20).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  approveBooking,
  createBooking,
  waitlistBooking,
} from "../../src/bookings/create-bookings-service.ts";
import { peekOutboxByAggregateForTests } from "../../src/bookings/in-memory-bookings.repository.ts";
import {
  DP1_TENANT_DENALI,
  dp1BookingBody,
  dp1CreateAndApprovePending,
  dp1GetBooking,
  dp1ListBookingsByStatus,
  dp1OpsAuth,
  requirePaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

async function expireTwice(registrationId: string): Promise<void> {
  const mod = (await import("../../src/finance/payment-hold-expiry.ts")) as {
    expirePaymentHoldForRegistration(input: {
      tenantId: string;
      registrationId: string;
    }): Promise<void>;
  };
  await mod.expirePaymentHoldForRegistration({
    tenantId: DP1_TENANT_DENALI,
    registrationId,
  });
  await mod.expirePaymentHoldForRegistration({
    tenantId: DP1_TENANT_DENALI,
    registrationId,
  });
}

describe("DP1-F payment hold expiry idempotency", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("S9: duplicate expiry execution is no-op", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, bookingId, "2030-01-01T00:00:00.000Z");
    await expireTwice(bookingId);

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: DP1_TENANT_DENALI,
      aggregateId: bookingId,
    });
    const expiredEvents = outbox.filter((row) => row.eventType === "payment.hold.expired");
    assert.equal(expiredEvents.length, 1, "expiry outbox must be idempotent");
    const cancelled = await dp1GetBooking(bookingId);
    assert.equal(cancelled.cancelSource, "payment_deadline");
    assert.equal(
      cancelled.cancellationApprovedByUserId,
      null,
      "automated expiry must not write a non-UUID system label into the human approver field"
    );
  });

  it("S20: repeated expiry never auto-promotes the waitlist", async () => {
    const approvedGuest = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Expire A", partySize: 2, tourCapacityMax: 2 })
    );
    const waitB = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Wait B", partySize: 2, tourCapacityMax: 2 })
    );
    await approveBooking(dp1OpsAuth(), approvedGuest.id);
    await waitlistBooking(dp1OpsAuth(), waitB.id);

    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, approvedGuest.id, "2030-01-01T00:00:00.000Z");
    await expireTwice(approvedGuest.id);

    const approved = await dp1ListBookingsByStatus("approved");
    assert.equal(approved.length, 0, "expiry must not bypass operator waitlist confirmation");
    assert.equal((await dp1GetBooking(waitB.id)).status, "waitlisted");
  });
});
