/**
 * DP1-F — payment vs expiry race (S3, S8) and concurrency.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  DP1_TENANT_DENALI,
  dp1CreateAndApprovePending,
  dp1GetBooking,
  requirePaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

async function racePaymentAndExpiry(registrationId: string): Promise<"payment" | "expiry"> {
  const mod = (await import("../../src/finance/payment-hold-expiry-race.ts")) as {
    racePaymentCaptureAgainstExpiry(input: {
      tenantId: string;
      registrationId: string;
      captureRemainingMinor: string;
    }): Promise<"payment" | "expiry">;
  };
  assert.equal(typeof mod.racePaymentCaptureAgainstExpiry, "function");
  return mod.racePaymentCaptureAgainstExpiry({
    tenantId: DP1_TENANT_DENALI,
    registrationId,
    captureRemainingMinor: "0",
  });
}

describe("DP1-F payment hold expiry race", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("S8 payment win: remainingMinor=0 keeps approved + satisfied hold", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    const winner = await racePaymentAndExpiry(bookingId);
    assert.equal(winner, "payment");

    const booking = await dp1GetBooking(bookingId);
    assert.equal(booking.status, "approved");
    assert.equal(booking.paymentStatus, "paid");

    const holdPort = await requirePaymentHoldPort();
    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, bookingId);
    assert.equal(hold?.status, "satisfied");
  });

  it("S3b/S8 expiry win: remainingMinor>0 at lock → cancelled", async () => {
    const mod = (await import("../../src/finance/payment-hold-expiry-race.ts")) as {
      racePaymentCaptureAgainstExpiry(input: {
        tenantId: string;
        registrationId: string;
        captureRemainingMinor: string;
      }): Promise<"payment" | "expiry">;
    };
    const { bookingId } = await dp1CreateAndApprovePending();
    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, bookingId, "2030-01-01T00:00:00.000Z");
    const winner = await mod.racePaymentCaptureAgainstExpiry({
      tenantId: DP1_TENANT_DENALI,
      registrationId: bookingId,
      captureRemainingMinor: "1000000",
    });
    assert.equal(winner, "expiry");

    const booking = await dp1GetBooking(bookingId);
    assert.equal(booking.status, "cancelled");
    assert.equal(booking.cancelSource, "payment_deadline");
  });
});
