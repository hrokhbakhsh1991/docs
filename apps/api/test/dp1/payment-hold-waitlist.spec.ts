/**
 * DP1-G — waitlist auto-promote on expiry (S6).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  approveBooking,
  createBooking,
  waitlistBooking,
} from "../../src/bookings/create-bookings-service.ts";
import {
  DP1_TENANT_DENALI,
  dp1BookingBody,
  dp1GetBooking,
  dp1OpsAuth,
  requirePaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

describe("DP1-G payment deadline waitlist", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("S6: expiry promotes one waitlisted guest with new hold + quote", async () => {
    const guestA = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Guest A", partySize: 2, tourCapacityMax: 2 })
    );
    const guestB = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Guest B", partySize: 2, tourCapacityMax: 2 })
    );
    await approveBooking(dp1OpsAuth(), guestA.id);
    await waitlistBooking(dp1OpsAuth(), guestB.id);

    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, guestA.id, "2030-01-01T00:00:00.000Z");
    const expiry = await import("../../src/finance/payment-hold-expiry.ts");
    await expiry.expirePaymentHoldForRegistration({
      tenantId: DP1_TENANT_DENALI,
      registrationId: guestA.id,
    });

    const promoted = await dp1GetBooking(guestB.id);
    assert.equal(promoted.status, "approved");
    assert.equal(promoted.paymentStatus, "unpaid");

    const promotedHold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, guestB.id);
    assert.ok(promotedHold !== null);
    assert.equal(promotedHold.status, "open");

    const quotePort = (await import("../../src/finance/commercial-quote-approve.service.ts")) as {
      createCommercialQuoteApproveServiceForTests: () => {
        getActiveQuote(tenantId: string, registrationId: string): Promise<{
          status: string;
        } | null>;
      };
    };
    const quote = await quotePort.createCommercialQuoteApproveServiceForTests().getActiveQuote(
      DP1_TENANT_DENALI,
      guestB.id
    );
    assert.equal(quote?.status, "FROZEN");
  });
});
