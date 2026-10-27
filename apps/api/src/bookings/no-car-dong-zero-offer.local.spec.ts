/** Focused BookingService integration proof for a dong request with no car offers. */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { logger } from "../observability/logger.ts";
import { createTourStorageRepository } from "../storage/create-tour-storage.ts";
import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "./create-bookings-repository.ts";
import {
  promoteAvailableWaitlistedGuests,
  promoteOldestWaitlistedGuest,
} from "./promote-waitlist-after-seat-release.ts";
import {
  createPublicGuestBooking,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";

const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const ZERO_CAR_TOUR_ID = "00000000-0000-4000-8000-000000000881";
const OTHER_TOUR_ID = "00000000-0000-4000-8000-000000000882";

const publicAuth: BookingActorContext = {
  tenantId: TENANT_DENALI,
  userId: "00000000-0000-4000-8000-000000000301",
  role: "none",
  status: "ACTIVE",
};

describe("local public BookingService no-car dong boundary", () => {
  const originalLoggerInfo = logger.info.bind(logger);
  const originalDiagnosticFlag = process.env.DENALI_CAPACITY_DIAGNOSTICS;
  const originalDiagnosticTourId = process.env.DENALI_CAPACITY_DIAGNOSTICS_TOUR_ID;
  let diagnosticEvents: Record<string, unknown>[] = [];

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
  });

  beforeEach(() => {
    process.env.DENALI_CAPACITY_DIAGNOSTICS = "false";
    delete process.env.DENALI_CAPACITY_DIAGNOSTICS_TOUR_ID;
    diagnosticEvents = [];
    (logger.info as unknown as (...args: unknown[]) => void) = (
      fields: Record<string, unknown>
    ) => {
      if (fields.event === "booking.capacity_policy_diagnostic") {
        diagnosticEvents.push(fields);
      }
    };
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  after(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
    (logger.info as unknown as (...args: unknown[]) => void) = originalLoggerInfo;
    if (originalDiagnosticFlag === undefined) {
      delete process.env.DENALI_CAPACITY_DIAGNOSTICS;
    } else {
      process.env.DENALI_CAPACITY_DIAGNOSTICS = originalDiagnosticFlag;
    }
    if (originalDiagnosticTourId === undefined) {
      delete process.env.DENALI_CAPACITY_DIAGNOSTICS_TOUR_ID;
    } else {
      process.env.DENALI_CAPACITY_DIAGNOSTICS_TOUR_ID = originalDiagnosticTourId;
    }
  });

  async function assertZeroCarRejected(tourId = ZERO_CAR_TOUR_ID): Promise<void> {
    await assert.rejects(
      () =>
        createPublicGuestBooking(publicAuth, {
          tourId,
          tourTitle: "Zero Car Seats Local Proof",
          guestLabel: "Zero-car dong candidate",
          guestEmail: "zero-car@example.com",
          guestPhone: "+15550009999",
          partySize: 1,
          departureAt: "2030-08-01T09:00:00.000Z",
          registrationIntake: {
            tourCapacityMax: 3,
            transport: { kind: "no_car_dong" },
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /^BOOKING_TRANSPORT_CAPACITY_REJECTED:/);
        assert.match(error.message, /dongSeatsRequired=1 carSeatsOffered=0/);
        return true;
      }
    );
  }

  it("rejects no-car dong without emitting diagnostics when disabled", async () => {
    process.env.DENALI_CAPACITY_DIAGNOSTICS = "false";
    process.env.DENALI_CAPACITY_DIAGNOSTICS_TOUR_ID = ZERO_CAR_TOUR_ID;

    await assertZeroCarRejected();

    assert.deepEqual(diagnosticEvents, []);
  });

  it("does not promote a no-car dong waitlist row when no car seats are offered", async () => {
    const repo = getBookingsRepository();
    await createTourStorageRepository().save({
      id: ZERO_CAR_TOUR_ID,
      tenantId: TENANT_DENALI,
      rowVersion: 1,
      createdAt: "2029-01-01T00:00:00.000Z",
      canonical: {
        schemaVersion: 1,
        roots: ["basics"],
        data: { capacityMax: 3 },
      },
    });
    const bookingId = "00000000-0000-4000-8000-000000000883";
    repo.seedBooking({
      id: bookingId,
      tenantId: TENANT_DENALI,
      tourId: ZERO_CAR_TOUR_ID,
      tourTitle: "Zero Car Waitlist Proof",
      guestLabel: "Waitlisted no-car dong candidate",
      guestEmail: "waitlist-zero-car@example.com",
      guestPhone: null,
      partySize: 1,
      status: "waitlisted",
      paymentStatus: "unpaid",
      departureAt: "2030-08-01T09:00:00.000Z",
      submittedAt: "2029-01-01T00:00:00.000Z",
      submittedByUserId: publicAuth.userId,
      approvedAt: null,
      registrationIntake: {
        tourCapacityMax: 3,
        transport: { kind: "no_car_dong" },
      },
    });

    assert.equal(
      await promoteOldestWaitlistedGuest({ tenantId: TENANT_DENALI, tourId: ZERO_CAR_TOUR_ID }),
      null
    );
    assert.equal((await repo.getById(bookingId, TENANT_DENALI))?.status, "waitlisted");

    const secondBookingId = "00000000-0000-4000-8000-000000000884";
    repo.seedBooking({
      id: secondBookingId,
      tenantId: TENANT_DENALI,
      tourId: ZERO_CAR_TOUR_ID,
      tourTitle: "Zero Car Waitlist Proof",
      guestLabel: "Available-promotion no-car dong candidate",
      guestEmail: "available-zero-car@example.com",
      guestPhone: null,
      partySize: 1,
      status: "waitlisted",
      paymentStatus: "unpaid",
      departureAt: "2030-08-01T09:00:00.000Z",
      submittedAt: "2029-01-02T00:00:00.000Z",
      submittedByUserId: publicAuth.userId,
      approvedAt: null,
      registrationIntake: {
        tourCapacityMax: 3,
        transport: { kind: "primary" },
      },
    });

    const promoted = await promoteAvailableWaitlistedGuests({
      tenantId: TENANT_DENALI,
      tourId: ZERO_CAR_TOUR_ID,
    });
    assert.deepEqual(
      promoted,
      [secondBookingId],
      JSON.stringify({
        first: await repo.getById(bookingId, TENANT_DENALI),
        second: await repo.getById(secondBookingId, TENANT_DENALI),
      })
    );
    assert.equal((await repo.getById(bookingId, TENANT_DENALI))?.status, "waitlisted");
    assert.equal((await repo.getById(secondBookingId, TENANT_DENALI))?.status, "approved");

    const thirdBookingId = "00000000-0000-4000-8000-000000000885";
    repo.seedBooking({
      id: thirdBookingId,
      tenantId: TENANT_DENALI,
      tourId: ZERO_CAR_TOUR_ID,
      tourTitle: "Zero Car Waitlist Proof",
      guestLabel: "Concurrent intake update candidate",
      guestEmail: "concurrent-zero-car@example.com",
      guestPhone: null,
      partySize: 1,
      status: "waitlisted",
      paymentStatus: "unpaid",
      departureAt: "2030-08-01T09:00:00.000Z",
      submittedAt: "2029-01-03T00:00:00.000Z",
      submittedByUserId: publicAuth.userId,
      approvedAt: null,
      registrationIntake: {
        tourCapacityMax: 3,
        transport: { kind: "primary" },
      },
    });
    const approveWithOutbox = repo.approveWithOutbox.bind(repo);
    repo.approveWithOutbox = async (input) => {
      if (input.bookingId === thirdBookingId) {
        await repo.mergeRegistrationIntake({
          bookingId: thirdBookingId,
          tenantId: TENANT_DENALI,
          patch: { transport: { kind: "no_car_dong" } },
          allowedStatuses: ["waitlisted"],
        });
      }
      return approveWithOutbox(input);
    };

    assert.deepEqual(
      await promoteAvailableWaitlistedGuests({ tenantId: TENANT_DENALI, tourId: ZERO_CAR_TOUR_ID }),
      []
    );
    assert.equal((await repo.getById(thirdBookingId, TENANT_DENALI))?.status, "waitlisted");
  });

  it("rejects no-car dong without emitting diagnostics for a different tour", async () => {
    process.env.DENALI_CAPACITY_DIAGNOSTICS = "true";
    process.env.DENALI_CAPACITY_DIAGNOSTICS_TOUR_ID = OTHER_TOUR_ID;

    await assertZeroCarRejected();

    assert.deepEqual(diagnosticEvents, []);
  });

  it("emits sanitized callback outcomes only for the exact configured tour", async () => {
    process.env.DENALI_CAPACITY_DIAGNOSTICS = "true";
    process.env.DENALI_CAPACITY_DIAGNOSTICS_TOUR_ID = ZERO_CAR_TOUR_ID;

    await assertZeroCarRejected();

    assert.deepEqual(
      diagnosticEvents.map(({ stage, outcome }) => ({ stage, outcome })),
      [
        { stage: "create", outcome: "invoked" },
        { stage: "create", outcome: "rejected" },
      ]
    );
    assert.equal(diagnosticEvents[0]?.candidateTransportKind, "no_car_dong");
    assert.equal(diagnosticEvents[0]?.offeredCarSeats, 0);
    assert.equal(diagnosticEvents[0]?.requiredDongSeats, 1);
    assert.equal(diagnosticEvents[1]?.reasonCode, "BOOKING_TRANSPORT_CAPACITY_REJECTED");
    assert.equal("tourId" in (diagnosticEvents[0] ?? {}), false);
    assert.equal("guestEmail" in (diagnosticEvents[0] ?? {}), false);

    diagnosticEvents = [];
    await assertZeroCarRejected(OTHER_TOUR_ID);
    assert.deepEqual(diagnosticEvents, []);
  });
});
