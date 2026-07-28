/**
 * Build BookingCreatePolicyContext for Denali domain asserts (orchestration helpers).
 */

import type { BookingCreatePolicyContext } from "@app-tour/booking-http-contracts";

export type BuildDenaliBookingCreatePolicyContextInput = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly guestEmail?: string;
  readonly guestPhone?: string;
  readonly partySize: number;
  readonly departureAt: string;
  readonly occupiedApprovedPartySize?: number;
  readonly tourCapacityMax: number | null;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
};

export function buildDenaliBookingCreatePolicyContext(
  input: BuildDenaliBookingCreatePolicyContextInput
): BookingCreatePolicyContext {
  return {
    tenantId: input.tenantId,
    tourId: input.tourId,
    tourTitle: input.tourTitle,
    guestLabel: input.guestLabel,
    ...(input.guestEmail !== undefined && input.guestEmail.trim().length > 0
      ? { guestEmail: input.guestEmail.trim() }
      : {}),
    ...(input.guestPhone !== undefined && input.guestPhone.trim().length > 0
      ? { guestPhone: input.guestPhone.trim() }
      : {}),
    partySize: input.partySize,
    departureAt: input.departureAt,
    occupiedApprovedPartySize: input.occupiedApprovedPartySize ?? 0,
    tourCapacityMax: input.tourCapacityMax,
    ...(input.registrationIntake !== undefined
      ? { registrationIntake: input.registrationIntake }
      : {}),
  };
}
