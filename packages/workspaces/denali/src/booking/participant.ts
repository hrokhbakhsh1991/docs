/**
 * Participant contribution to party size (Denali booking domain).
 * Host persists guest PII; this model is for policy math only.
 */

export type DenaliBookingParticipant = {
  readonly id?: string;
  readonly label?: string;
  /** Defaults to 1 when omitted. */
  readonly seats?: number;
};

/**
 * Sum seat contribution for a party. Empty list → 0 (caller must still enforce partySize >= 1 on create).
 */
export function denaliPartySizeFromParticipants(
  participants: readonly DenaliBookingParticipant[]
): number {
  let total = 0;
  for (const participant of participants) {
    const seats = participant.seats ?? 1;
    if (!Number.isFinite(seats) || seats < 1 || !Number.isInteger(seats)) {
      throw new Error("BOOKING_VALIDATION_REJECTED: participant seats must be an integer >= 1");
    }
    total += seats;
  }
  return total;
}
