/**
 * Booking lifecycle ownership — cancel / waitlist / terminal consistency.
 *
 * Behavioral proofs (P1):
 * - approve → cancel
 * - pending → waitlisted
 * - waitlisted → approve
 * - rejected cannot approve
 * - cancelled cannot approve
 * - reject persists with zero outbox (silent ≠ cancel)
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
  BOOKING_POLICY_CASE_A_GUEST_LABEL,
  BOOKING_WAITLIST_OUTBOX_EVENT_TYPE,
} from "@app-tour/booking-http-contracts";

import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import { peekOutboxByAggregateForTests } from "./in-memory-bookings.repository.ts";
import {
  approveBooking,
  cancelBooking,
  createBooking,
  rejectBooking,
  resetBookingsServiceCompositionForTests,
  waitlistBooking,
} from "./create-bookings-service.ts";
import { BookingStatusConflictError } from "./bookings.errors.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";

const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TOUR_DENALI = "00000000-0000-4000-8000-000000000891";

function opsAuth(tenantId: string): BookingActorContext {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000201",
    role: "admin",
    status: "ACTIVE",
  };
}

function body(guestLabel: string, partySize = 2) {
  return {
    tourId: TOUR_DENALI,
    tourTitle: "Lifecycle Tour",
    guestLabel,
    guestEmail: `${guestLabel.replace(/\s+/g, "-").toLowerCase()}@example.com`,
    guestPhone: "+15550009999",
    partySize,
    departureAt: "2031-06-01T10:00:00.000Z",
    registrationIntake: { tourCapacityMax: 20 },
  };
}

describe("booking lifecycle ownership", { concurrency: false }, () => {
  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  after(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("approve → cancel emits registration.cancelled and frees approve path", async () => {
    const created = await createBooking(
      opsAuth(TENANT_DENALI),
      body(BOOKING_POLICY_CASE_A_GUEST_LABEL)
    );
    const approved = await approveBooking(opsAuth(TENANT_DENALI), created.id);
    assert.equal(approved.status, "approved");

    const cancelled = await cancelBooking(opsAuth(TENANT_DENALI), created.id);
    assert.equal(cancelled.status, "cancelled");

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: TENANT_DENALI,
      aggregateId: created.id,
    });
    assert.ok(outbox.some((row) => row.eventType === BOOKING_CANCEL_OUTBOX_EVENT_TYPE));
  });

  it("pending → waitlisted emits registration.waitlisted", async () => {
    const created = await createBooking(
      opsAuth(TENANT_DENALI),
      body("Waitlist Guest")
    );
    assert.equal(created.status, "pending");

    const waitlisted = await waitlistBooking(opsAuth(TENANT_DENALI), created.id);
    assert.equal(waitlisted.status, "waitlisted");

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: TENANT_DENALI,
      aggregateId: created.id,
    });
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]?.eventType, BOOKING_WAITLIST_OUTBOX_EVENT_TYPE);
  });

  it("waitlisted → approve succeeds", async () => {
    const created = await createBooking(
      opsAuth(TENANT_DENALI),
      body("Waitlist Then Approve")
    );
    await waitlistBooking(opsAuth(TENANT_DENALI), created.id);
    const approved = await approveBooking(opsAuth(TENANT_DENALI), created.id);
    assert.equal(approved.status, "approved");
  });

  it("rejected cannot approve", async () => {
    const created = await createBooking(
      opsAuth(TENANT_DENALI),
      body("Reject Terminal")
    );
    await rejectBooking(opsAuth(TENANT_DENALI), created.id, {});
    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_DENALI), created.id),
      (err: unknown) => err instanceof BookingStatusConflictError
    );
  });

  it("cancelled cannot approve", async () => {
    const created = await createBooking(
      opsAuth(TENANT_DENALI),
      body("Cancel Terminal")
    );
    await cancelBooking(opsAuth(TENANT_DENALI), created.id);
    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_DENALI), created.id),
      (err: unknown) => err instanceof BookingStatusConflictError
    );
  });

  it("reject: persists status and emits no outbox (silent ≠ cancel)", async () => {
    const created = await createBooking(
      opsAuth(TENANT_DENALI),
      body("Reject No Outbox")
    );
    await rejectBooking(opsAuth(TENANT_DENALI), created.id, { reason: "nope" });
    const outbox = await peekOutboxByAggregateForTests({
      tenantId: TENANT_DENALI,
      aggregateId: created.id,
    });
    assert.equal(outbox.length, 0);
  });
});
