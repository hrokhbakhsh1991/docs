import type { MemberProfileFieldId } from "./member-profile-field-id";

/** Coded error when invalid; `null` when value is acceptable (including empty clear). */
export type MemberProfileFieldValidator = (value: string) => string | null;

export const MEMBER_PROFILE_DISPLAY_NAME_MAX_LENGTH = 80;
export const MEMBER_PROFILE_FATHER_NAME_MAX_LENGTH = 200;

const NATIONAL_ID_PATTERN = /^\d{10}$/;
const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateMemberProfileNationalId(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return NATIONAL_ID_PATTERN.test(trimmed) ? null : "PROFILE_NATIONAL_ID_INVALID";
}

export function validateMemberProfileBirthDate(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return BIRTH_DATE_PATTERN.test(trimmed) ? null : "PROFILE_BIRTH_DATE_INVALID";
}

export function validateMemberProfileFatherName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.length <= MEMBER_PROFILE_FATHER_NAME_MAX_LENGTH
    ? null
    : "PROFILE_FATHER_NAME_INVALID";
}

export function validateMemberProfileDisplayName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MEMBER_PROFILE_DISPLAY_NAME_MAX_LENGTH) {
    return "PROFILE_DISPLAY_NAME_INVALID";
  }
  return null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateMemberProfileEmail(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.length <= 320 && EMAIL_PATTERN.test(trimmed) ? null : "PROFILE_EMAIL_INVALID";
}

const MEMBER_PROFILE_FIELD_VALIDATORS: Readonly<
  Partial<Record<MemberProfileFieldId, MemberProfileFieldValidator>>
> = Object.freeze({
  displayName: validateMemberProfileDisplayName,
  email: validateMemberProfileEmail,
  nationalId: validateMemberProfileNationalId,
  fatherName: validateMemberProfileFatherName,
  birthDate: validateMemberProfileBirthDate,
});

export function resolveMemberProfileFieldValidator(
  fieldId: MemberProfileFieldId
): MemberProfileFieldValidator | undefined {
  return MEMBER_PROFILE_FIELD_VALIDATORS[fieldId];
}
