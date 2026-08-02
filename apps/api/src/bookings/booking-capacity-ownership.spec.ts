/**
 * Capacity ownership — one decision point (BookingsService + capacityPolicy).
 * Denali hybrid supplies max; Booking decides occupancy on create + approve.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BOOKING_POLICY_CASE_A_GUEST_LABEL } from "@app-tour/booking-http-contracts";

import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  approveBooking,
  createBooking,
  createPublicGuestBooking,
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";

const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TENANT_WS2 = "00000000-0000-4000-8000-000000000015";
const TOUR_ID = "00000000-0000-4000-8000-000000000881";

function opsAuth(tenantId: string): BookingActorContext {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000201",
    role: "admin",
    status: "ACTIVE",
  };
}

function publicAuth(tenantId: string): BookingActorContext {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000301",
    role: "none",
    status: "ACTIVE",
  };
}

function baseBody(over: Partial<{
  guestLabel: string;
  partySize: number;
  tourCapacityMax: number;
}> = {}) {
  const tourCapacityMax = over.tourCapacityMax ?? 10;
  return {
    tourId: TOUR_ID,
    tourTitle: "Capacity Ownership Tour",
    guestLabel: over.guestLabel ?? "Capacity Guest",
    guestEmail: "capacity@example.com",
    guestPhone: "+15550009999",
    partySize: over.partySize ?? 1,
    departureAt: "2030-08-01T09:00:00.000Z",
    registrationIntake: { tourCapacityMax },
  };
}

describe("booking capacity ownership (single decision point)", () => {
  before(async () => {
    process.env.STORAGE_DRIVER = "memory";
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  after(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("denali over-capacity create is rejected by Booking capacityPolicy", async () => {
    await assert.rejects(
      () =>
        createPublicGuestBooking(
          publicAuth(TENANT_DENALI),
          baseBody({ partySize: 11, tourCapacityMax: 10 })
        ),
      (err: unknown) =>
        err instanceof Error && err.message.startsWith("BOOKING_CAPACITY_REJECTED")
    );
    await assert.rejects(
      () =>
        createBooking(opsAuth(TENANT_DENALI), baseBody({ partySize: 11, tourCapacityMax: 10 })),
      (err: unknown) =>
        err instanceof Error && err.message.startsWith("BOOKING_CAPACITY_REJECTED")
    );
  });

  it("booking-ws2 over-capacity create is rejected by Booking capacityPolicy", async () => {
    await assert.rejects(
      () =>
        createPublicGuestBooking(
          publicAuth(TENANT_WS2),
          baseBody({ partySize: 11, tourCapacityMax: 10 })
        ),
      (err: unknown) =>
        err instanceof Error && err.message.startsWith("BOOKING_CAPACITY_REJECTED")
    );
  });

  it("approve pending booking that would exceed capacity is rejected", async () => {
    // Pending does not consume seats — both creates succeed; second approve must fail.
    const first = await createBooking(
      opsAuth(TENANT_DENALI),
      baseBody({ guestLabel: "First", partySize: 6, tourCapacityMax: 10 })
    );
    const second = await createBooking(
      opsAuth(TENANT_DENALI),
      baseBody({ guestLabel: "Second", partySize: 6, tourCapacityMax: 10 })
    );

    await approveBooking(opsAuth(TENANT_DENALI), first.id);

    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_DENALI), second.id),
      (err: unknown) =>
        err instanceof Error && err.message.startsWith("BOOKING_CAPACITY_REJECTED")
    );
  });

  it("same process: denali vs booking-ws2 capacity markers stay independent", async () => {
    const denali = getOrCreateBookingRuntimeForWorkspaceType("denali");
    const ws2 = getOrCreateBookingRuntimeForWorkspaceType("booking-ws2");
    assert.notEqual(denali.service, ws2.service);

    const caseA = baseBody({
      guestLabel: BOOKING_POLICY_CASE_A_GUEST_LABEL,
      partySize: 1,
      tourCapacityMax: 10,
    });

    const accepted = await createPublicGuestBooking(publicAuth(TENANT_DENALI), caseA);
    assert.equal(accepted.status, "pending");

    await assert.rejects(
      () => createPublicGuestBooking(publicAuth(TENANT_WS2), caseA),
      (err: unknown) =>
        err instanceof Error && err.message.startsWith("BOOKING_CAPACITY_REJECTED")
    );

    // Absolute over-capacity still rejects on both after marker path.
    await assert.rejects(
      () =>
        createBooking(opsAuth(TENANT_DENALI), baseBody({ partySize: 12, tourCapacityMax: 10 })),
      /BOOKING_CAPACITY_REJECTED/
    );
    await assert.rejects(
      () => createBooking(opsAuth(TENANT_WS2), baseBody({ partySize: 12, tourCapacityMax: 10 })),
      /BOOKING_CAPACITY_REJECTED/
    );
  });

  it("denali registration validation no longer owns capacity (supply-only)", () => {
    // Import-boundary: do not dynamically import packages/workspaces/* from apps/api.
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(here, "../../../../packages/workspaces/denali/src/http/registration.validation.ts"),
      "utf8"
    );
    assert.match(src, /export function validateDenaliRegistrationPayload/);
    assert.match(src, /enforcePartySizeCapacity:\s*false/);
  });
});
