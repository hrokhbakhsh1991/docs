/**
 * In-memory BookingsRepository.updatePaymentStatus (finance sync).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resetBookingsRepositoryForTests } from "../src/bookings/create-bookings-repository.ts";

describe("bookings-update-payment-status.spec.ts", () => {
  it("BPAY-02 raises unpaid→paid and refuses downgrade", async () => {
    const repo = resetBookingsRepositoryForTests();
    repo.seedBooking({
      id: "b1",
      tenantId: "t1",
      tourId: "tour-1",
      tourTitle: "Alborz",
      guestLabel: "Ada",
      guestEmail: null,
      guestPhone: null,
      partySize: 1,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt: "2026-08-01T00:00:00.000Z",
      submittedAt: "2026-07-01T00:00:00.000Z",
      submittedByUserId: "u1",
      approvedAt: null,
    });
    const paid = await repo.updatePaymentStatus({
      bookingId: "b1",
      tenantId: "t1",
      paymentStatus: "paid",
    });
    assert.equal(paid?.paymentStatus, "paid");
    const stuck = await repo.updatePaymentStatus({
      bookingId: "b1",
      tenantId: "t1",
      paymentStatus: "partial",
    });
    assert.equal(stuck?.paymentStatus, "paid");
    assert.equal(
      await repo.updatePaymentStatus({
        bookingId: "missing",
        tenantId: "t1",
        paymentStatus: "paid",
      }),
      null
    );
  });
});
