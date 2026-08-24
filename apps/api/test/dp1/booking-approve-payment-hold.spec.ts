/**
 * DP1-C / S1 — approve creates payment hold + frozen quote.
 * @see docs/dev/dp-1-execution-plan.md
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { peekOutboxByAggregateForTests } from "../../src/bookings/in-memory-bookings.repository.ts";
import {
  DP1_TENANT_DENALI,
  assertDp1ApproveSideEffects,
  dp1BookingBody,
  dp1CreateAndApprovePending,
  dp1OpsAuth,
  loadPaymentHoldPort,
  requireCommercialQuoteApprovePort,
  requirePaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";
import { approveBooking, createBooking } from "../../src/bookings/create-bookings-service.ts";

describe("DP1-C booking approve payment hold", { concurrency: false }, () => {
  before(() => {
    resetDp1MemoryHarness();
  });

  beforeEach(() => {
    resetDp1MemoryHarness();
  });

  after(() => {
    resetDp1MemoryHarness();
  });

  it("S1: approve → unpaid → deadline + quote freeze + hold open", async () => {
    const created = await createBooking(dp1OpsAuth(), dp1BookingBody());
    const approved = await approveBooking(dp1OpsAuth(), created.id);
    assertDp1ApproveSideEffects(approved, approved.approvedAt, approved.commercialQuotePayableMinor ?? "0");

    const holdPort = await loadPaymentHoldPort();
    assert.ok(holdPort !== null, "DP1-EXPECTED-FAIL: PaymentHoldService not implemented");
    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, created.id);
    assert.ok(hold !== null, "DP1-EXPECTED-FAIL: hold row missing after approve");
    assert.equal(hold.status, "open");

    const quotePort = await requireCommercialQuoteApprovePort();
    const quote = await quotePort.getActiveQuote(DP1_TENANT_DENALI, created.id);
    assert.ok(quote !== null, "DP1-EXPECTED-FAIL: commercial quote missing after approve");
    assert.equal(quote.status, "FROZEN");

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: DP1_TENANT_DENALI,
      aggregateId: created.id,
    });
    const eventTypes = outbox.map((row) => row.eventType);
    assert.ok(eventTypes.includes("registration.approved"));
    assert.ok(
      eventTypes.includes("payment.hold.scheduled"),
      "DP1-EXPECTED-FAIL: payment.hold.scheduled outbox missing"
    );
  });

  it("S1 idempotent: second approve does not duplicate hold", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    await assert.rejects(
      () => approveBooking(dp1OpsAuth(), bookingId),
      /BOOKING_STATUS_CONFLICT|BOOKING_ALREADY_APPROVED|already approved/i
    );
    const holdPort = await requirePaymentHoldPort();
    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, bookingId);
    assert.ok(hold !== null);
    const outbox = await peekOutboxByAggregateForTests({
      tenantId: DP1_TENANT_DENALI,
      aggregateId: bookingId,
    });
    const scheduled = outbox.filter((row) => row.eventType === "payment.hold.scheduled");
    assert.equal(scheduled.length, 1, "hold scheduled event must be idempotent");
  });
});
