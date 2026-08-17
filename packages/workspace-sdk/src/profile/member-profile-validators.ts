import { isOperatorProfileGender } from "../operator/identity/operator-profile-gender";

import type { MemberProfileFieldId } from "./member-profile-field-id";

/** Coded error when invalid; `null` when value is acceptable (including empty clear). */
export type MemberProfileFieldValidator = (value: string) => string | null;

export const MEMBER_PROFILE_DISPLAY_NAME_MAX_LENGTH = 80;
export const MEMBER_PROFILE_FATHER_NAME_MAX_LENGTH = 200;

const NATIONAL_ID_PATTERN = /^\d{10}$/;
const BIRTH_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `format` = not 10 digits; `checksum` = 10 digits that fail IR checksum or all-same. */
export type IranianNationalIdClass = "ok" | "format" | "checksum";

/**
 * Iranian national ID checksum (`locale=IR` for platform field `nationalId`).
 * @see docs/phase-19/platform-portal-member-profile.mdoc field validator contract
 */
export function classifyIranianNationalId(value: string): IranianNationalIdClass {
  const digits = value.trim();
  if (!NATIONAL_ID_PATTERN.test(digits)) {
    return "format";
  }
  if (/^(\d)\1{9}$/.test(digits)) {
    return "checksum";
  }
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(digits[index]) * (10 - index);
  }
  const remainder = sum % 11;
  const checkDigit = Number(digits[9]);
  const checksumOk = remainder < 2 ? checkDigit === remainder : checkDigit === 11 - remainder;
  return checksumOk ? "ok" : "checksum";
}

function isValidCalendarIsoDate(value: string): boolean {
  const match = BIRTH_DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

function isNotAfterTodayUtc(value: string): boolean {
  const match = BIRTH_DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidateUtc = Date.UTC(year, month - 1, day);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return candidateUtc <= todayUtc;
}

export function validateMemberProfileNationalId(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const classified = classifyIranianNationalId(trimmed);
  if (classified === "ok") {
    return null;
  }
  return classified === "format" ? "PROFILE_NATIONAL_ID_INVALID" : "PROFILE_NATIONAL_ID_CHECKSUM";
}

export function validateMemberProfileBirthDate(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!isValidCalendarIsoDate(trimmed) || !isNotAfterTodayUtc(trimmed)) {
    return "PROFILE_BIRTH_DATE_INVALID";
  }
  return null;
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

export function validateMemberProfileGender(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return isOperatorProfileGender(trimmed) ? null : "PROFILE_GENDER_INVALID";
}

const MEMBER_PROFILE_FIELD_VALIDATORS: Readonly<
  Partial<Record<MemberProfileFieldId, MemberProfileFieldValidator>>
> = Object.freeze({
  displayName: validateMemberProfileDisplayName,
  email: validateMemberProfileEmail,
  nationalId: validateMemberProfileNationalId,
  fatherName: validateMemberProfileFatherName,
  birthDate: validateMemberProfileBirthDate,
  gender: validateMemberProfileGender,
});

export function resolveMemberProfileFieldValidator(
  fieldId: MemberProfileFieldId
): MemberProfileFieldValidator | undefined {
  return MEMBER_PROFILE_FIELD_VALIDATORS[fieldId];
}
