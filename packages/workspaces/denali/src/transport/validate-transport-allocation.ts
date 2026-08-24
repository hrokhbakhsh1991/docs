/**
 * DP-5 — validate transport allocation facts.
 */
import type {
  RosterParticipant,
  TransportAllocationInput,
  ValidateAllocationsInput,
  ValidateAllocationsResult,
} from "./transport-allocation-types";

function participantById(
  participants: readonly RosterParticipant[],
  id: string
): RosterParticipant | undefined {
  return participants.find((p) => p.registrationId === id);
}

export function validateTransportAllocations(
  input: ValidateAllocationsInput
): ValidateAllocationsResult {
  if (input.rosterFrozen) {
    return {
      ok: false,
      code: "ROSTER_FROZEN",
      message: "Allocations cannot change after roster freeze",
    };
  }

  const passengerToDriver = new Map<string, string>();
  const driverPassengerCounts = new Map<string, number>();

  for (const alloc of input.allocations) {
    const driver = participantById(input.participants, alloc.driverRegistrationId);
    const passenger = participantById(input.participants, alloc.passengerRegistrationId);

    if (driver === undefined) {
      return {
        ok: false,
        code: "DRIVER_NOT_FOUND",
        message: `Driver registration ${alloc.driverRegistrationId} not found`,
      };
    }
    if (passenger === undefined) {
      return {
        ok: false,
        code: "PASSENGER_NOT_FOUND",
        message: `Passenger registration ${alloc.passengerRegistrationId} not found`,
      };
    }
    if (driver.transportKind !== "personal_car") {
      return {
        ok: false,
        code: "NOT_DRIVER_OFFER",
        message: `Registration ${alloc.driverRegistrationId} is not a personal_car driver`,
      };
    }
    if (passenger.status !== "approved") {
      return {
        ok: false,
        code: "PASSENGER_NOT_APPROVED",
        message: `Passenger ${alloc.passengerRegistrationId} must be approved`,
      };
    }
    if (alloc.driverRegistrationId === alloc.passengerRegistrationId) {
      return {
        ok: false,
        code: "SELF_ASSIGNMENT",
        message: "Driver cannot be assigned as own passenger",
      };
    }
    if (passengerToDriver.has(alloc.passengerRegistrationId)) {
      return {
        ok: false,
        code: "DUPLICATE_PASSENGER",
        message: `Passenger ${alloc.passengerRegistrationId} already assigned`,
      };
    }
    passengerToDriver.set(alloc.passengerRegistrationId, alloc.driverRegistrationId);

    const offered = driver.personalCarOccupants ?? 0;
    const current = driverPassengerCounts.get(alloc.driverRegistrationId) ?? 0;
    const next = current + 1;
    if (next > offered) {
      return {
        ok: false,
        code: "CAPACITY_EXCEEDED",
        message: `Driver ${alloc.driverRegistrationId} exceeds offered seats (${offered})`,
      };
    }
    driverPassengerCounts.set(alloc.driverRegistrationId, next);
  }

  return { ok: true };
}

export function countAssignedPassengers(
  allocations: readonly TransportAllocationInput[],
  driverRegistrationId: string
): number {
  return allocations.filter((a) => a.driverRegistrationId === driverRegistrationId).length;
}
