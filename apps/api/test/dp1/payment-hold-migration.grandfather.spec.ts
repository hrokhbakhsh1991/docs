/**
 * DP1-K — grandfather / migration compatibility.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  approveBooking,
  createBooking,
} from "../../src/bookings/create-bookings-service.ts";
import {
  DP1_TENANT_DENALI,
  dp1BookingBody,
  dp1GetBooking,
  dp1OpsAuth,
  loadPaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

describe("DP1-K payment hold migration grandfather", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("grandfather: approved-unpaid without hold is not expired by worker", async () => {
    process.env.PAYMENT_HOLD_ENABLED = "false";
    const created = await createBooking(dp1OpsAuth(), dp1BookingBody());
    const approved = await approveBooking(dp1OpsAuth(), created.id);
    assert.equal(approved.status, "approved");

    const holdPort = await loadPaymentHoldPort();
    if (holdPort !== null) {
      const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, created.id);
      assert.equal(hold, null, "legacy approve must not create hold when flag off");
    }

    const scheduler = (await import("../../src/finance/start-payment-hold-expiry-scheduler.ts")) as {
      runPaymentHoldExpiryTickForTests(nowIso: string): Promise<number>;
    };
    const processed = await scheduler.runPaymentHoldExpiryTickForTests("2099-01-01T00:00:00.000Z");
    assert.equal(processed, 0);

    const booking = await dp1GetBooking(created.id);
    assert.equal(booking.status, "approved");
    assert.equal(booking.paymentStatus, "unpaid");
  });

  it("already-paid registration without hold remains approved under worker", async () => {
    const mod = (await import("../../src/finance/payment-hold-migration.fixture.ts")) as {
      seedGrandfatherPaidWithoutHold(input: {
        tenantId: string;
        registrationId: string;
      }): Promise<void>;
    };
    const registrationId = "00000000-0000-4000-8000-000000009901";
    await mod.seedGrandfatherPaidWithoutHold({
      tenantId: DP1_TENANT_DENALI,
      registrationId,
    });
    const scheduler = (await import("../../src/finance/start-payment-hold-expiry-scheduler.ts")) as {
      runPaymentHoldExpiryTickForTests(nowIso: string): Promise<number>;
    };
    await scheduler.runPaymentHoldExpiryTickForTests("2099-01-01T00:00:00.000Z");
    const booking = await dp1GetBooking(registrationId);
    assert.equal(booking.status, "approved");
    assert.equal(booking.paymentStatus, "paid");
  });

  it("rollback: PAYMENT_HOLD_EXPIRY_ENABLED=false stops new expiries", async () => {
    process.env.PAYMENT_HOLD_EXPIRY_ENABLED = "false";
    const mod = (await import("../../src/finance/payment-hold-migration.fixture.ts")) as {
      seedOpenHoldPastDue(input: {
        tenantId: string;
        registrationId: string;
      }): Promise<void>;
    };
    const registrationId = "00000000-0000-4000-8000-000000009902";
    await mod.seedOpenHoldPastDue({ tenantId: DP1_TENANT_DENALI, registrationId });
    const scheduler = (await import("../../src/finance/start-payment-hold-expiry-scheduler.ts")) as {
      runPaymentHoldExpiryTickForTests(nowIso: string): Promise<number>;
    };
    const processed = await scheduler.runPaymentHoldExpiryTickForTests("2099-01-01T00:00:00.000Z");
    assert.equal(processed, 0);
  });
});
