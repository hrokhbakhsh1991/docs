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
  bulkApproveBookings,
  cancelBooking,
  createBooking,
  createPublicGuestBooking,
  getBooking,
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
  waitlistBooking,
} from "./create-bookings-service.ts";
import { createTourStorageRepository } from "../storage/create-tour-storage.ts";
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

function baseBody(
  over: Partial<{
    guestLabel: string;
    partySize: number;
    tourCapacityMax: number;
  }> = {}
) {
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

  it("public over-capacity create is rejected, while operator create defers the gate to approval", async () => {
    await assert.rejects(
      () =>
        createPublicGuestBooking(
          publicAuth(TENANT_DENALI),
          baseBody({ partySize: 11, tourCapacityMax: 10 })
        ),
      (err: unknown) => err instanceof Error && err.message.startsWith("BOOKING_CAPACITY_REJECTED")
    );
    const operatorCreated = await createBooking(
      opsAuth(TENANT_DENALI),
      baseBody({ partySize: 11, tourCapacityMax: 10 })
    );
    assert.equal(operatorCreated.status, "pending");
    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_DENALI), operatorCreated.id),
      /BOOKING_CAPACITY_REJECTED/
    );
    const waitlisted = await waitlistBooking(opsAuth(TENANT_DENALI), operatorCreated.id);
    assert.equal(waitlisted.status, "waitlisted");
  });

  it("booking-ws2 over-capacity create is rejected by Booking capacityPolicy", async () => {
    await assert.rejects(
      () =>
        createPublicGuestBooking(
          publicAuth(TENANT_WS2),
          baseBody({ partySize: 11, tourCapacityMax: 10 })
        ),
      (err: unknown) => err instanceof Error && err.message.startsWith("BOOKING_CAPACITY_REJECTED")
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
      (err: unknown) => err instanceof Error && err.message.startsWith("BOOKING_CAPACITY_REJECTED")
    );
  });

  it("Denali dong seat offers are enforced on locked approval without blocking non-dong transport", async () => {
    const dongGroup = await createBooking(opsAuth(TENANT_DENALI), {
      ...baseBody({ guestLabel: "Dong seats", partySize: 2, tourCapacityMax: 10 }),
      registrationIntake: { tourCapacityMax: 10, transport: { kind: "no_car_dong" } },
    });
    await waitlistBooking(opsAuth(TENANT_DENALI), dongGroup.id);

    const carDriver = await createBooking(opsAuth(TENANT_DENALI), {
      ...baseBody({ guestLabel: "Car driver", tourCapacityMax: 10 }),
      registrationIntake: {
        tourCapacityMax: 10,
        transport: { kind: "personal_car", personalCarOccupants: 2 },
      },
    });
    await approveBooking(opsAuth(TENANT_DENALI), carDriver.id);
    assert.equal((await getBooking(opsAuth(TENANT_DENALI), dongGroup.id))?.status, "waitlisted");
    // A capacity event must not bypass the tour's safe manual-approval default.
    await approveBooking(opsAuth(TENANT_DENALI), dongGroup.id);
    assert.equal((await getBooking(opsAuth(TENANT_DENALI), dongGroup.id))?.status, "approved");

    const extraDong = await createBooking(opsAuth(TENANT_DENALI), {
      ...baseBody({ guestLabel: "Dong overflow", tourCapacityMax: 10 }),
      registrationIntake: { tourCapacityMax: 10, transport: { kind: "no_car_dong" } },
    });
    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_DENALI), extraDong.id),
      /constraint=personal_car_dong/
    );

    const selfTransport = await createBooking(opsAuth(TENANT_DENALI), {
      ...baseBody({ guestLabel: "Self transport", tourCapacityMax: 10 }),
      registrationIntake: {
        tourCapacityMax: 10,
        transport: { kind: "no_car_acquaintance" },
      },
    });
    const bulkResult = await bulkApproveBookings(opsAuth(TENANT_DENALI), {
      ids: [extraDong.id, selfTransport.id],
    });
    assert.deepEqual(bulkResult.approvedIds, [selfTransport.id]);
    assert.deepEqual(bulkResult.skippedIds, [extraDong.id]);
  });

  it("four car offers share five dong seats while the tour keeps its independent ten-person ceiling", async () => {
    const offeredSeats = [2, 1, 1, 1] as const;
    for (const [index, passengerSeats] of offeredSeats.entries()) {
      const driver = await createBooking(opsAuth(TENANT_DENALI), {
        ...baseBody({ guestLabel: `Capacity driver ${index + 1}`, tourCapacityMax: 10 }),
        registrationIntake: {
          tourCapacityMax: 10,
          transport: { kind: "personal_car", personalCarOccupants: passengerSeats },
        },
      });
      await approveBooking(opsAuth(TENANT_DENALI), driver.id);
    }

    for (let index = 0; index < 5; index += 1) {
      const passenger = await createBooking(opsAuth(TENANT_DENALI), {
        ...baseBody({ guestLabel: `Dong passenger ${index + 1}`, tourCapacityMax: 10 }),
        registrationIntake: { tourCapacityMax: 10, transport: { kind: "no_car_dong" } },
      });
      await approveBooking(opsAuth(TENANT_DENALI), passenger.id);
    }

    // Four drivers + five dong riders = nine tour participants, but all five
    // offered car seats are consumed. The sixth dong request cannot be approved.
    const sixthDongPassenger = await createBooking(opsAuth(TENANT_DENALI), {
      ...baseBody({ guestLabel: "Sixth dong passenger", tourCapacityMax: 10 }),
      registrationIntake: { tourCapacityMax: 10, transport: { kind: "no_car_dong" } },
    });
    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_DENALI), sixthDongPassenger.id),
      /constraint=personal_car_dong/
    );
    assert.equal(
      (await getBooking(opsAuth(TENANT_DENALI), sixthDongPassenger.id))?.status,
      "pending"
    );

    // The remaining tour-wide place is still usable by someone who does not
    // require a shared-car seat.
    const selfTransport = await createBooking(opsAuth(TENANT_DENALI), {
      ...baseBody({ guestLabel: "Independent transport", tourCapacityMax: 10 }),
      registrationIntake: {
        tourCapacityMax: 10,
        transport: { kind: "no_car_acquaintance" },
      },
    });
    await approveBooking(opsAuth(TENANT_DENALI), selfTransport.id);
    assert.equal((await getBooking(opsAuth(TENANT_DENALI), selfTransport.id))?.status, "approved");
  });

  it("auto-approval tours promote eligible dong waitlist rows when a car adds seats", async () => {
    await createTourStorageRepository().save({
      id: TOUR_ID,
      tenantId: TENANT_DENALI,
      rowVersion: 1,
      createdAt: new Date(0).toISOString(),
      canonical: {
        schemaVersion: 1,
        roots: [],
        data: {
          capacityMax: 10,
          pricing: { registrationApproval: "auto" },
        },
      },
    });

    const dongGuest = await createBooking(opsAuth(TENANT_DENALI), {
      ...baseBody({ guestLabel: "Auto-mode dong guest", tourCapacityMax: 10 }),
      registrationIntake: { tourCapacityMax: 10, transport: { kind: "no_car_dong" } },
    });
    await waitlistBooking(opsAuth(TENANT_DENALI), dongGuest.id);
    const driver = await createBooking(opsAuth(TENANT_DENALI), {
      ...baseBody({ guestLabel: "Auto-mode driver", tourCapacityMax: 10 }),
      registrationIntake: {
        tourCapacityMax: 10,
        transport: { kind: "personal_car", personalCarOccupants: 1 },
      },
    });

    await approveBooking(opsAuth(TENANT_DENALI), driver.id);
    assert.equal((await getBooking(opsAuth(TENANT_DENALI), dongGuest.id))?.status, "approved");
  });

  it("does not cancel an approved car when that would strand approved dong passengers", async () => {
    const driver = await createBooking(opsAuth(TENANT_DENALI), {
      ...baseBody({ guestLabel: "Protected car driver", tourCapacityMax: 10 }),
      registrationIntake: {
        tourCapacityMax: 10,
        transport: { kind: "personal_car", personalCarOccupants: 1 },
      },
    });
    await approveBooking(opsAuth(TENANT_DENALI), driver.id);
    const passenger = await createBooking(opsAuth(TENANT_DENALI), {
      ...baseBody({ guestLabel: "Protected dong passenger", tourCapacityMax: 10 }),
      registrationIntake: { tourCapacityMax: 10, transport: { kind: "no_car_dong" } },
    });
    await approveBooking(opsAuth(TENANT_DENALI), passenger.id);

    await assert.rejects(
      () => cancelBooking(opsAuth(TENANT_DENALI), driver.id),
      /BOOKING_DONG_SEAT_REASSIGNMENT_REQUIRED/
    );
    assert.equal((await getBooking(opsAuth(TENANT_DENALI), driver.id))?.status, "approved");
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
      (err: unknown) => err instanceof Error && err.message.startsWith("BOOKING_CAPACITY_REJECTED")
    );

    // Operator over-capacity records are created first; approval remains the gate.
    const denaliPending = await createBooking(
      opsAuth(TENANT_DENALI),
      baseBody({ partySize: 12, tourCapacityMax: 10 })
    );
    const ws2Pending = await createBooking(
      opsAuth(TENANT_WS2),
      baseBody({ partySize: 12, tourCapacityMax: 10 })
    );
    assert.equal(denaliPending.status, "pending");
    assert.equal(ws2Pending.status, "pending");
    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_DENALI), denaliPending.id),
      /BOOKING_CAPACITY_REJECTED/
    );
    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_WS2), ws2Pending.id),
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
