import type { OperatorProfileResponse } from "../identity/me.types";

const PROFILE_COMPLETION_FIELDS = [
  "displayName",
  "email",
  "gender",
  "nationalId",
  "fatherName",
  "birthDate",
] as const;

export function isMemberProfileComplete(profile: OperatorProfileResponse): boolean {
  if (profile.displayName.trim().length === 0) {
    return false;
  }
  if (profile.email === null || profile.email.trim().length === 0) {
    return false;
  }
  if (profile.gender === null) {
    return false;
  }
  if (profile.nationalId === null || profile.nationalId.trim().length !== 10) {
    return false;
  }
  if (profile.fatherName === null || profile.fatherName.trim().length === 0) {
    return false;
  }
  if (profile.birthDate === null || profile.birthDate.trim().length === 0) {
    return false;
  }
  return true;
}

export function listProfileCompletionFieldIds(): readonly string[] {
  return PROFILE_COMPLETION_FIELDS;
}
