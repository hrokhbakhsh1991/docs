/**
 * DP1-G — payment expiry releases capacity without auto-promoting waitlist (S6).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  approveBooking,
  cancelBooking,
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

  it("S6: expiry keeps the next guest waitlisted for operator confirmation", async () => {
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

    const retained = await dp1GetBooking(guestB.id);
    assert.equal(retained.status, "waitlisted");
    assert.equal(retained.paymentStatus, "unpaid");

    const retainedHold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, guestB.id);
    assert.equal(retainedHold, null);

    const quotePort = (await import("../../src/finance/commercial-quote-approve.service.ts")) as {
      createCommercialQuoteApproveServiceForTests: () => {
        getActiveQuote(
          tenantId: string,
          registrationId: string
        ): Promise<{
          status: string;
        } | null>;
      };
    };
    const quote = await quotePort
      .createCommercialQuoteApproveServiceForTests()
      .getActiveQuote(DP1_TENANT_DENALI, guestB.id);
    assert.equal(quote, null);
  });

  it("BUG-STG-063: promotion keeps a group waitlisted when released seats do not fit its partySize", async () => {
    // Create the large candidate before occupancy exists, then fill most seats with
    // an approved booking. Releasing that booking leaves fewer seats than the candidate needs.
    const groupCandidate = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Group Candidate", partySize: 12 })
    );
    const blockingBooking = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Blocking Booking", partySize: 1 })
    );
    const retainedBooking = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Retained Booking", partySize: 1 })
    );
    await approveBooking(dp1OpsAuth(), blockingBooking.id);
    await approveBooking(dp1OpsAuth(), retainedBooking.id);
    await waitlistBooking(dp1OpsAuth(), groupCandidate.id);

    await cancelBooking(dp1OpsAuth(), blockingBooking.id);

    const candidate = await dp1GetBooking(groupCandidate.id);
    assert.equal(candidate.status, "waitlisted");
    const holdPort = await requirePaymentHoldPort();
    assert.equal(await holdPort.getByRegistrationId(DP1_TENANT_DENALI, groupCandidate.id), null);
    const quotePort = (await import("../../src/finance/commercial-quote-approve.service.ts")) as {
      createCommercialQuoteApproveServiceForTests: () => {
        getActiveQuote(
          tenantId: string,
          registrationId: string
        ): Promise<{ status: string } | null>;
      };
    };
    assert.equal(
      await quotePort
        .createCommercialQuoteApproveServiceForTests()
        .getActiveQuote(DP1_TENANT_DENALI, groupCandidate.id),
      null
    );
  });
});
