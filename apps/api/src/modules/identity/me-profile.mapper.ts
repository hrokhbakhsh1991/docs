import { normalizeOtpPhoneInput } from "../../common/phone/otp-phone-normalize";
import { UserRole, tryParseWorkspaceUserRole } from "../../common/auth/user-role.enum";
import type { UserEntity } from "./entities/user.entity";
import type { MeProfileResponse, SelfPiiSnapshot } from "./me-profile.types";
export type MeProfileVisibility = {
  viewerUserId: string;
  subjectUserId: string;
  viewerRole?: string;
};

export function canExposeNationalId(visibility: MeProfileVisibility): boolean {
  if (visibility.viewerUserId.trim() === visibility.subjectUserId.trim()) {
    return true;
  }
  const role = tryParseWorkspaceUserRole(String(visibility.viewerRole ?? "").trim());
  return role === UserRole.Owner || role === UserRole.Admin;
}

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

export function mapUserEntityToMeProfileResponse(
  user: UserEntity,
  visibility: MeProfileVisibility
): MeProfileResponse {
  const rawPhone = user.phone?.trim() ?? "";
  const storedEmail = user.email?.trim() ?? "";
  const publicEmail = storedEmail !== "" ? storedEmail : null;
  const exposeNationalId = canExposeNationalId(visibility);
  return {
    id: user.id,
    full_name: user.fullName ?? null,
    national_id: exposeNationalId ? (user.nationalId ?? null) : null,
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

export function snapshotSelfPiiFromUser(user: UserEntity, visibility: MeProfileVisibility): SelfPiiSnapshot {
  const exposeNationalId = canExposeNationalId(visibility);
  return {
    full_name: user.fullName ?? null,
    national_id: exposeNationalId ? (user.nationalId ?? null) : null,
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
