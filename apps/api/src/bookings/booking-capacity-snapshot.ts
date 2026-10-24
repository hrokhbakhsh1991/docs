import type { BookingApprovedCapacitySnapshot } from "./booking-capacity.types";

/**
 * Projects only the capacity-relevant portion of registration intake.
 * In particular, identity/profile fields must never be copied into policy context.
 */
export function toBookingApprovedCapacitySnapshot(input: {
  readonly partySize: number;
  readonly registrationIntake?: unknown;
}): BookingApprovedCapacitySnapshot {
  const intake = input.registrationIntake;
  if (intake === null || typeof intake !== "object" || Array.isArray(intake)) {
    return { partySize: input.partySize };
  }
  const transport = (intake as Readonly<Record<string, unknown>>).transport;
  if (transport === null || typeof transport !== "object" || Array.isArray(transport)) {
    return { partySize: input.partySize };
  }
  return {
    partySize: input.partySize,
    registrationIntake: { transport },
  };
}
