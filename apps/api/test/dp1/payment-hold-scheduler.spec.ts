/**
 * DP1-E scheduler durability (S18, S19).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { peekOutboxByAggregateForTests } from "../../src/bookings/in-memory-bookings.repository.ts";
import {
  DP1_TENANT_DENALI,
  dp1CreateAndApprovePending,
  dp1GetBooking,
  requirePaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

describe("DP1-E payment hold scheduler", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("S18: worker resumes after restart and expires due holds", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, bookingId, "2030-01-01T00:00:00.000Z");

    const scheduler =
      (await import("../../src/finance/start-payment-hold-expiry-scheduler.ts")) as {
        runPaymentHoldExpiryTickForTests(nowIso: string): Promise<number>;
        resetPaymentHoldExpirySchedulerForTests(): void;
      };
    assert.equal(typeof scheduler.runPaymentHoldExpiryTickForTests, "function");
    scheduler.resetPaymentHoldExpirySchedulerForTests?.();
    const processed = await scheduler.runPaymentHoldExpiryTickForTests("2031-01-01T00:00:00.000Z");
    assert.ok(processed >= 1);

    const booking = await dp1GetBooking(bookingId);
    assert.equal(booking.status, "cancelled");
  });

  it("S19: delayed worker skips already-paid registration", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    const holdPort = await requirePaymentHoldPort();
    await holdPort.satisfy(DP1_TENANT_DENALI, bookingId);

    const scheduler =
      (await import("../../src/finance/start-payment-hold-expiry-scheduler.ts")) as {
        runPaymentHoldExpiryTickForTests(nowIso: string): Promise<number>;
      };
    const processed = await scheduler.runPaymentHoldExpiryTickForTests("2031-01-01T00:00:00.000Z");
    assert.equal(processed, 0);

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: DP1_TENANT_DENALI,
      aggregateId: bookingId,
    });
    assert.equal(outbox.filter((row) => row.eventType === "payment.hold.expired").length, 0);
  });

  it("returns a stoppable interval handle when expiry is enabled", async () => {
    const prior = {
      paymentHoldEnabled: process.env.PAYMENT_HOLD_ENABLED,
      paymentHoldExpiryEnabled: process.env.PAYMENT_HOLD_EXPIRY_ENABLED,
      intervalMs: process.env.PAYMENT_HOLD_EXPIRY_INTERVAL_MS,
    };
    process.env.PAYMENT_HOLD_ENABLED = "true";
    process.env.PAYMENT_HOLD_EXPIRY_ENABLED = "true";
    process.env.PAYMENT_HOLD_EXPIRY_INTERVAL_MS = "60000";
    try {
      const scheduler = await import("../../src/finance/start-payment-hold-expiry-scheduler.ts");
      const handle = scheduler.startPaymentHoldExpiryScheduler();
      assert.equal(typeof handle.stop, "function");
      handle.stop();
    } finally {
      if (prior.paymentHoldEnabled === undefined) delete process.env.PAYMENT_HOLD_ENABLED;
      else process.env.PAYMENT_HOLD_ENABLED = prior.paymentHoldEnabled;
      if (prior.paymentHoldExpiryEnabled === undefined) {
        delete process.env.PAYMENT_HOLD_EXPIRY_ENABLED;
      } else {
        process.env.PAYMENT_HOLD_EXPIRY_ENABLED = prior.paymentHoldExpiryEnabled;
      }
      if (prior.intervalMs === undefined) delete process.env.PAYMENT_HOLD_EXPIRY_INTERVAL_MS;
      else process.env.PAYMENT_HOLD_EXPIRY_INTERVAL_MS = prior.intervalMs;
    }
  });
});
