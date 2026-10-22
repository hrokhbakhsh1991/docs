import type { BookingStatus } from "@app-tour/booking-http-contracts";

import type { OperationalRosterCapacitySummary } from "./operational-roster-contract";

export type OperationalRosterCapacityFact = {
  readonly partySize: number;
  readonly status: BookingStatus;
  readonly transportKind: string | null;
  readonly personalCarOccupants: number | null;
};

function seatCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** Derive both Denali capacity pools from the same full-tour booking snapshot. */
export function summarizeOperationalRosterCapacity(input: {
  readonly capacityMax: number | null;
  readonly bookings: readonly OperationalRosterCapacityFact[];
}): OperationalRosterCapacitySummary {
  let approvedParticipants = 0;
  let approvedDriverOffers = 0;
  let approvedDongParticipants = 0;
  let waitlistedDongParticipants = 0;
  let pendingParticipants = 0;
  let pendingDongParticipants = 0;
  let pendingDriverOffers = 0;
  const waitlistedDongParties: number[] = [];

  for (const booking of input.bookings) {
    const partySize = Math.max(1, seatCount(booking.partySize));
    const driverOffer =
      booking.transportKind === "personal_car" ? seatCount(booking.personalCarOccupants ?? 0) : 0;
    if (booking.status === "approved") {
      approvedParticipants += partySize;
      approvedDriverOffers += driverOffer;
      if (booking.transportKind === "no_car_dong") approvedDongParticipants += partySize;
    } else if (booking.status === "waitlisted" && booking.transportKind === "no_car_dong") {
      waitlistedDongParticipants += partySize;
      waitlistedDongParties.push(partySize);
    } else if (booking.status === "pending") {
      pendingParticipants += partySize;
      pendingDriverOffers += driverOffer;
      if (booking.transportKind === "no_car_dong") pendingDongParticipants += partySize;
    }
  }

  const capacityMax =
    input.capacityMax !== null && Number.isFinite(input.capacityMax) && input.capacityMax >= 1
      ? Math.trunc(input.capacityMax)
      : null;
  const remainingTourSeats =
    capacityMax === null ? null : Math.max(0, capacityMax - approvedParticipants);
  const remainingDongSeats = Math.max(0, approvedDriverOffers - approvedDongParticipants);

  return {
    capacityMax,
    approvedParticipants,
    remainingTourSeats,
    approvedDriverOffers,
    approvedDongParticipants,
    remainingDongSeats,
    waitlistedDongParticipants,
    pendingParticipants,
    pendingDongParticipants,
    pendingDriverOffers,
    dongWaitlistBlockedByCarSeats:
      waitlistedDongParties.length > 0 &&
      (remainingTourSeats ?? 0) > 0 &&
      !waitlistedDongParties.some((partySize) => partySize <= remainingDongSeats),
  };
}
