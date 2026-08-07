/**
 * Phase 3 — public auto-approve (no ops CASL); capacity fail → stay pending.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { BOOKING_POLICY_CASE_A_GUEST_LABEL } from "@app-tour/booking-http-contracts";

import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  autoApprovePublicBooking,
  createPublicGuestBooking,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import { BookingNotFoundError } from "./bookings.errors.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";

const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TOUR_DENALI = "00000000-0000-4000-8000-000000000891";
const GUEST_A = "00000000-0000-4000-8000-000000000301";
const GUEST_B = "00000000-0000-4000-8000-000000000302";

function publicAuth(userId: string): BookingActorContext {
  return {
    tenantId: TENANT_DENALI,
    userId,
    role: "none",
    status: "ACTIVE",
  };
}

function body(guestLabel: string, partySize = 2) {
  return {
    tourId: TOUR_DENALI,
    tourTitle: "Auto Approve Tour",
    guestLabel,
    guestEmail: `${guestLabel.replace(/\s+/g, "-").toLowerCase()}@example.com`,
    guestPhone: "+15550009999",
    partySize,
    departureAt: "2031-06-01T10:00:00.000Z",
    registrationIntake: { tourCapacityMax: 20 },
  };
}

describe("booking public auto-approve", { concurrency: false }, () => {
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

  it("P3-BA-01 submitter can auto-approve own pending booking", async () => {
    const created = await createPublicGuestBooking(
      publicAuth(GUEST_A),
      body(BOOKING_POLICY_CASE_A_GUEST_LABEL)
    );
    assert.equal(created.status, "pending");
    const approved = await autoApprovePublicBooking({
      tenantId: TENANT_DENALI,
      bookingId: created.id,
      actorUserId: GUEST_A,
    });
    assert.equal(approved.id, created.id);
    assert.equal(approved.status, "approved");
  });

  it("P3-BA-02 non-submitter cannot auto-approve", async () => {
    const created = await createPublicGuestBooking(
      publicAuth(GUEST_A),
      body("Other Guest Label")
    );
    await assert.rejects(
      () =>
        autoApprovePublicBooking({
          tenantId: TENANT_DENALI,
          bookingId: created.id,
          actorUserId: GUEST_B,
        }),
      BookingNotFoundError
    );
  });

  it("P3-BA-03 capacity reject leaves pending", async () => {
    // Soft create: pending does not consume seats — both fit while unapproved.
    const first = await createPublicGuestBooking(
      publicAuth(GUEST_A),
      body("Seat Hogger A", 15)
    );
    const second = await createPublicGuestBooking(
      publicAuth(GUEST_B),
      body("Seat Hogger B", 10)
    );
    assert.equal(first.status, "pending");
    assert.equal(second.status, "pending");

    const approvedFirst = await autoApprovePublicBooking({
      tenantId: TENANT_DENALI,
      bookingId: first.id,
      actorUserId: GUEST_A,
    });
    assert.equal(approvedFirst.status, "approved");

    const result = await autoApprovePublicBooking({
      tenantId: TENANT_DENALI,
      bookingId: second.id,
      actorUserId: GUEST_B,
    });
    assert.equal(result.status, "pending");
  });
});
