import type { BookingTarget, RegistrationIntakeValues, RegistrationPrefillSource } from "./types";

const BLANK_GUEST_INTAKE: Omit<RegistrationIntakeValues, "bookingTarget"> = {
  participantFullName: "",
  participantContactPhone: "",
  participantNationalId: "",
  transportMode: "group_vehicle",
  participantNote: "",
  vehicleSeatCapacity: undefined,
  userPastPeaksCount: 0,
};

export function guestIntakeDefaults(): RegistrationIntakeValues {
  return { bookingTarget: "guest", ...BLANK_GUEST_INTAKE };
}

export function selfIntakeFromProfile(
  me: RegistrationPrefillSource | null | undefined,
): RegistrationIntakeValues {
  const fullName = typeof me?.full_name === "string" ? me.full_name.trim() : "";
  const phone = typeof me?.phone === "string" ? me.phone.trim() : "";
  const nationalId =
    typeof me?.national_id === "string" && me.national_id.trim() !== ""
      ? me.national_id.trim()
      : "";

  return {
    bookingTarget: "self",
    participantFullName: fullName,
    participantContactPhone: phone,
    participantNationalId: nationalId,
    transportMode: "group_vehicle",
    participantNote: "",
    vehicleSeatCapacity: undefined,
    userPastPeaksCount: 0,
  };
}

/** Switch target: self → hydrate from profile; guest → clear participant identity fields. */
export function intakeDefaultsForTarget(
  target: BookingTarget,
  me: RegistrationPrefillSource | null | undefined,
): RegistrationIntakeValues {
  return target === "self" ? selfIntakeFromProfile(me) : guestIntakeDefaults();
}
