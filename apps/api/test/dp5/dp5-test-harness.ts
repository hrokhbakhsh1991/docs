/**
 * DP-5 test harness — driver settlement scenarios.
 */
import { randomUUID } from "node:crypto";

import {
  approveBooking,
  createBooking,
  resetBookingsServiceCompositionForTests,
} from "../../src/bookings/create-bookings-service.ts";
import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "../../src/bookings/create-bookings-repository.ts";
import { resetDriverPayableStoreForTests } from "../../src/finance/driver-payable.repository.ts";
import { resetDriverSettlementStoreForTests } from "../../src/settlement/driver-settlement.repository.ts";
import { resetTransportAllocationStoreForTests } from "../../src/transport/transport-allocation.repository.ts";
import type { BookingActorContext } from "../../src/bookings/ports/booking-actor-context.ts";
import { OPERATOR_SMOKE } from "../fixtures/operator-smoke-e2e-tenant.ts";

export const DP5_TOUR_ID = "00000000-0000-4000-8000-000000000901";
export const DP5_UNIT_MINOR = "50000";
export const DP5_CURRENCY = "IRR";

export function dp5OpsAuth(tenantId = OPERATOR_SMOKE.tenantId): BookingActorContext {
  return {
    tenantId,
    userId: OPERATOR_SMOKE.adminUserId,
    role: "admin",
    status: "ACTIVE",
  };
}

export function resetDp5Harness(): void {
  resetBookingsRepositoryForTests();
  resetBookingsServiceCompositionForTests();
  resetTransportAllocationStoreForTests();
  resetDriverSettlementStoreForTests();
  resetDriverPayableStoreForTests();
}

export async function dp5SeedDriverAndPassengers(input?: {
  readonly offeredSeats?: 1 | 2 | 3;
  readonly passengerCount?: number;
}): Promise<{
  readonly driverId: string;
  readonly passengerIds: string[];
}> {
  const offered = input?.offeredSeats ?? 3;
  const passengerCount = input?.passengerCount ?? 2;
  const auth = dp5OpsAuth();
  const departureAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const driver = await createBooking(auth, {
    tourId: DP5_TOUR_ID,
    tourTitle: "DP5 Driver Settlement Tour",
    guestLabel: `Driver ${randomUUID().slice(0, 6)}`,
    guestEmail: "driver@dp5.example.com",
    guestPhone: "+15550003001",
    partySize: 1,
    departureAt,
    registrationIntake: {
      tourCapacityMax: 20,
      transport: { kind: "personal_car", personalCarOccupants: offered },
    },
  });
  const approvedDriver = await approveBooking(auth, driver.id);

  const passengerIds: string[] = [];
  for (let i = 0; i < passengerCount; i += 1) {
    const passenger = await createBooking(auth, {
      tourId: DP5_TOUR_ID,
      tourTitle: "DP5 Driver Settlement Tour",
      guestLabel: `Passenger ${i + 1}`,
      guestEmail: `passenger${i + 1}@dp5.example.com`,
      guestPhone: `+1555000301${i}`,
      partySize: 1,
      departureAt,
      registrationIntake: { tourCapacityMax: 20, transport: { kind: "primary" } },
    });
    const approved = await approveBooking(auth, passenger.id);
    passengerIds.push(approved.id);
  }

  return { driverId: approvedDriver.id, passengerIds };
}

export function dp5SeedBookingsDirect(input: {
  readonly driverId: string;
  readonly passengerIds: readonly string[];
  readonly offeredSeats?: 1 | 2 | 3;
}): void {
  const repo = getBookingsRepository();
  const now = new Date().toISOString();
  repo.seedBooking({
    id: input.driverId,
    tenantId: OPERATOR_SMOKE.tenantId,
    tourId: DP5_TOUR_ID,
    tourTitle: "DP5 Tour",
    guestLabel: "Driver Direct",
    guestEmail: "driver@dp5.example.com",
    guestPhone: "+15550003001",
    partySize: 1,
    status: "approved",
    paymentStatus: "unpaid",
    departureAt: now,
    submittedAt: now,
    submittedByUserId: OPERATOR_SMOKE.memberUserId,
    approvedAt: now,
    transportKind: "personal_car",
    personalCarOccupants: input.offeredSeats ?? 3,
    registrationIntake: {
      tourCapacityMax: 20,
      transport: { kind: "personal_car", personalCarOccupants: input.offeredSeats ?? 3 },
    },
  });
  for (const passengerId of input.passengerIds) {
    repo.seedBooking({
      id: passengerId,
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: DP5_TOUR_ID,
      tourTitle: "DP5 Tour",
      guestLabel: `Passenger ${passengerId.slice(0, 4)}`,
      guestEmail: "passenger@dp5.example.com",
      guestPhone: "+15550003002",
      partySize: 1,
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: now,
      submittedAt: now,
      submittedByUserId: OPERATOR_SMOKE.memberUserId,
      approvedAt: now,
      transportKind: "primary",
      personalCarOccupants: null,
      registrationIntake: { tourCapacityMax: 20, transport: { kind: "primary" } },
    });
  }
}
