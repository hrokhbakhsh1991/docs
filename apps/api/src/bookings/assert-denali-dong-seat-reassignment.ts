import type { BookingCapacityTransportFact } from "@app-tour/booking-http-contracts";

import { BookingDongSeatReassignmentRequiredError } from "./bookings.errors.ts";
import type { BookingRecord } from "./bookings.types.ts";
import { toBookingCapacityTransportFact } from "./read-transport-kind-from-intake.ts";

/** Fail closed if removing this approved driver would strand confirmed dong passengers. */
export function assertDenaliDongSeatReassignment(input: {
  readonly booking: BookingRecord;
  readonly approvedTransportFacts: readonly BookingCapacityTransportFact[];
}): void {
  if (input.booking.status !== "approved") {
    return;
  }

  const removedCar = toBookingCapacityTransportFact({
    partySize: input.booking.partySize,
    registrationIntake: input.booking.registrationIntake,
  });
  if (removedCar.transportKind !== "personal_car") {
    return;
  }

  const confirmedDongPartySize = input.approvedTransportFacts
    .filter((fact) => fact.transportKind === "no_car_dong")
    .reduce((sum, fact) => sum + fact.partySize, 0);
  const allOfferedSeats = input.approvedTransportFacts
    .filter((fact) => fact.transportKind === "personal_car")
    .reduce((sum, fact) => sum + (fact.offeredPassengerSeats ?? 0), 0);
  const remainingOfferedSeats = Math.max(
    0,
    allOfferedSeats - (removedCar.offeredPassengerSeats ?? 0)
  );

  if (confirmedDongPartySize > remainingOfferedSeats) {
    throw new BookingDongSeatReassignmentRequiredError();
  }
}
