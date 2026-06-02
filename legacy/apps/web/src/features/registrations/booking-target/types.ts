import type { MeProfileWire } from "@repo/types";

export type BookingTarget = "self" | "guest";

/** Tour + workspace rules that tighten validation beyond baseline intake. */
export type RegistrationFieldPolicy = {
  /** From `tripDetails.participation.registrationNationalIdRequired`. */
  nationalIdRequired: boolean;
  /** True when `GET /api/me` already has `national_id` on the signed-in user. */
  profileNationalIdPresent: boolean;
  /** From `tripDetails.participation.sportsInsuranceRequired`. */
  sportsInsuranceRequired: boolean;
  /** Peak-Experience intake (existing `tourShowsPeakExperienceIntake`). */
  requirePeakHistory: boolean;
  /** From tour `registrationPolicy.allowPrivateCar` (BFF) or resolver fallback. */
  allowPrivateCar: boolean;
};

export type RegistrationIntakeValues = {
  bookingTarget: BookingTarget;
  participantFullName: string;
  participantContactPhone: string;
  /** Guest-only when tour mandates ID on traveler (product choice); self uses profile gate. */
  participantNationalId: string;
  transportMode: "self_vehicle" | "group_vehicle" | "other";
  participantNote?: string;
  vehicleSeatCapacity?: number;
  userPastPeaksCount?: number;
};

export type RegistrationPrefillSource = Pick<
  MeProfileWire,
  "full_name" | "phone" | "national_id"
>;
