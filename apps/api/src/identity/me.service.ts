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

export async function patchOperatorProfile(
  auth: TenantAuthContext,
  patch: PatchOperatorProfileRequest
): Promise<OperatorProfileResponse> {
  const hasDisplayName = "displayName" in patch;
  const hasGender = "gender" in patch;
  if (!hasDisplayName && !hasGender) {
    return getOperatorProfile(auth);
  }

  const profilePatch: {
    displayName?: string;
    gender?: OperatorProfileGender | null;
  } = {};

  if (hasDisplayName) {
    const trimmed = patch.displayName?.trim() ?? "";
    if (trimmed.length === 0 || trimmed.length > PROFILE_DISPLAY_NAME_MAX_LENGTH) {
      throw new ProfileDisplayNameInvalidError();
    }
    profilePatch.displayName = trimmed;
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
