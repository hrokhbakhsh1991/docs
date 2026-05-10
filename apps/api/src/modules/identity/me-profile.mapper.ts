import { normalizeOtpPhoneInput } from "../../common/phone/otp-phone-normalize";
import type { UserEntity } from "./entities/user.entity";
import type { MeProfileResponse, SelfPiiSnapshot } from "./me-profile.types";
import { isSyntheticIdentityPlaceholderEmail } from "./utils/synthetic-identity-email";

export function formatUserDateColumnAsYmd(v: Date | string | null | undefined): string | null {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === "string") {
    return v.slice(0, 10);
  }
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

export function mapUserEntityToMeProfileResponse(user: UserEntity): MeProfileResponse {
  const rawPhone = user.phone?.trim() ?? "";
  const storedEmail = user.email?.trim() ?? "";
  const publicEmail =
    storedEmail !== "" && !isSyntheticIdentityPlaceholderEmail(storedEmail) ? storedEmail : null;
  return {
    id: user.id,
    full_name: user.fullName ?? null,
    national_id: user.nationalId ?? null,
    gender: user.gender ?? null,
    birth_date: formatUserDateColumnAsYmd(user.birthDate),
    email: publicEmail,
    is_email_verified: user.isEmailVerified === true,
    phone: rawPhone === "" ? null : normalizeOtpPhoneInput(rawPhone),
    is_phone_verified: user.isPhoneVerified === true,
    notifications_enabled: user.notificationsEnabled ?? null,
    profile_row_version: user.profileRowVersion
  };
}

export function snapshotSelfPiiFromUser(user: UserEntity): SelfPiiSnapshot {
  return {
    full_name: user.fullName ?? null,
    national_id: user.nationalId ?? null,
    gender: user.gender ?? null,
    birth_date: formatUserDateColumnAsYmd(user.birthDate)
  };
}

export function diffSelfPiiFieldKeys(before: SelfPiiSnapshot, after: SelfPiiSnapshot): string[] {
  const keys = ["full_name", "national_id", "gender", "birth_date"] as const;
  const changed: string[] = [];
  for (const k of keys) {
    if (before[k] !== after[k]) {
      changed.push(k);
    }
  }
  return changed;
}
