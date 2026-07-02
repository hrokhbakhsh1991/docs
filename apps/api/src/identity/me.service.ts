import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { isOperatorProfileGender, type OperatorProfileGender } from "@app-tour/workspace-sdk";

import { getIdentityRepository } from "./create-identity-repository";
import type { IdentityMembershipRecord, IdentityUserRecord } from "./in-memory-identity.repository";
import { MembershipNotFoundError } from "./in-memory-identity.repository";
import type { OperatorProfileResponse, PatchOperatorProfileRequest } from "./me.types";
import { resolveOperatorAvatarUrlForMembership } from "./operator-avatar-storage";

export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 80;

export class ProfileDisplayNameInvalidError extends Error {
  readonly code = "PROFILE_DISPLAY_NAME_INVALID" as const;

  constructor() {
    super("PROFILE_DISPLAY_NAME_INVALID");
    this.name = "ProfileDisplayNameInvalidError";
  }
}

export class ProfileGenderInvalidError extends Error {
  readonly code = "PROFILE_GENDER_INVALID" as const;

  constructor() {
    super("PROFILE_GENDER_INVALID");
    this.name = "ProfileGenderInvalidError";
  }
}

function resolveDisplayName(
  user: IdentityUserRecord,
  membership: IdentityMembershipRecord
): string {
  const trimmed = membership.displayName?.trim();
  if (trimmed !== undefined && trimmed.length > 0) {
    return trimmed;
  }
  return user.mobile;
}

async function toProfileResponse(
  user: IdentityUserRecord,
  membership: IdentityMembershipRecord
): Promise<OperatorProfileResponse> {
  const avatarUrl = await resolveOperatorAvatarUrlForMembership(
    membership.tenantId,
    user.id,
    membership.avatar?.storageKey
  );
  return {
    userId: user.id,
    tenantId: membership.tenantId,
    role: membership.role,
    status: membership.status,
    workspaceId: membership.workspaceId ?? null,
    mobile: user.mobile,
    displayName: resolveDisplayName(user, membership),
    email: membership.email?.trim() ?? null,
    nationalId: membership.nationalId?.trim() ?? null,
    fatherName: membership.fatherName?.trim() ?? null,
    birthDate: membership.birthDate?.trim() ?? null,
    gender: membership.gender ?? null,
    avatarUrl,
  };
}

export async function getOperatorProfile(
  auth: TenantAuthContext
): Promise<OperatorProfileResponse> {
  const repo = getIdentityRepository();
  const user = await repo.findUserById(auth.userId);
  if (user === null) {
    throw new MembershipNotFoundError(auth.userId);
  }
  const membership = await repo.findMembership(auth.userId, auth.tenantId);
  if (membership === null) {
    throw new MembershipNotFoundError(auth.userId);
  }
  return toProfileResponse(user, membership);
}

export class ProfileNationalIdInvalidError extends Error {
  readonly code = "PROFILE_NATIONAL_ID_INVALID" as const;

  constructor() {
    super("PROFILE_NATIONAL_ID_INVALID");
    this.name = "ProfileNationalIdInvalidError";
  }
}

export class ProfileFatherNameInvalidError extends Error {
  readonly code = "PROFILE_FATHER_NAME_INVALID" as const;

  constructor() {
    super("PROFILE_FATHER_NAME_INVALID");
    this.name = "ProfileFatherNameInvalidError";
  }
}

export class ProfileBirthDateInvalidError extends Error {
  readonly code = "PROFILE_BIRTH_DATE_INVALID" as const;

  constructor() {
    super("PROFILE_BIRTH_DATE_INVALID");
    this.name = "ProfileBirthDateInvalidError";
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ProfileEmailInvalidError extends Error {
  readonly code = "PROFILE_EMAIL_INVALID" as const;

  constructor() {
    super("PROFILE_EMAIL_INVALID");
    this.name = "ProfileEmailInvalidError";
  }
}

export async function patchOperatorProfile(
  auth: TenantAuthContext,
  patch: PatchOperatorProfileRequest
): Promise<OperatorProfileResponse> {
  const hasDisplayName = "displayName" in patch;
  const hasEmail = "email" in patch;
  const hasGender = "gender" in patch;
  const hasNationalId = "nationalId" in patch;
  const hasFatherName = "fatherName" in patch;
  const hasBirthDate = "birthDate" in patch;
  if (!hasDisplayName && !hasEmail && !hasGender && !hasNationalId && !hasFatherName && !hasBirthDate) {
    return getOperatorProfile(auth);
  }

  const profilePatch: {
    displayName?: string;
    email?: string;
    gender?: OperatorProfileGender | null;
    nationalId?: string;
    fatherName?: string;
    birthDate?: string;
  } = {};

  if (hasDisplayName) {
    const trimmed = patch.displayName?.trim() ?? "";
    if (trimmed.length === 0 || trimmed.length > PROFILE_DISPLAY_NAME_MAX_LENGTH) {
      throw new ProfileDisplayNameInvalidError();
    }
    profilePatch.displayName = trimmed;
  }

  if (hasEmail) {
    if (patch.email === null) {
      profilePatch.email = "";
    } else {
      const trimmed = patch.email?.trim() ?? "";
      if (trimmed.length > 0 && (trimmed.length > 320 || !EMAIL_PATTERN.test(trimmed))) {
        throw new ProfileEmailInvalidError();
      }
      profilePatch.email = trimmed;
    }
  }

  if (hasGender) {
    if (
      patch.gender !== null &&
      patch.gender !== undefined &&
      !isOperatorProfileGender(patch.gender)
    ) {
      throw new ProfileGenderInvalidError();
    }
    profilePatch.gender = patch.gender ?? null;
  }

  if (hasNationalId) {
    const trimmed = patch.nationalId?.trim() ?? "";
    if (trimmed.length > 0 && !/^\d{10}$/.test(trimmed)) {
      throw new ProfileNationalIdInvalidError();
    }
    profilePatch.nationalId = trimmed;
  }

  if (hasFatherName) {
    const trimmed = patch.fatherName?.trim() ?? "";
    if (trimmed.length > 200) {
      throw new ProfileFatherNameInvalidError();
    }
    profilePatch.fatherName = trimmed;
  }

  if (hasBirthDate) {
    const trimmed = patch.birthDate?.trim() ?? "";
    if (trimmed.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new ProfileBirthDateInvalidError();
    }
    profilePatch.birthDate = trimmed;
  }

  const repo = getIdentityRepository();
  const user = await repo.findUserById(auth.userId);
  if (user === null) {
    throw new MembershipNotFoundError(auth.userId);
  }

  const membership = await repo.updateMembershipProfileFields(
    auth.tenantId,
    auth.userId,
    profilePatch
  );
  return toProfileResponse(user, membership);
}
