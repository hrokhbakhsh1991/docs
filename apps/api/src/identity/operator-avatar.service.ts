import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getIdentityRepository } from "./create-identity-repository";
import { MembershipNotFoundError } from "./in-memory-identity.repository";
import { getOperatorProfile, type OperatorProfileResponse } from "./me.service";
import {
  deleteOperatorAvatarObject,
  getOperatorAvatarSignedReadUrl,
  putOperatorAvatar,
} from "./operator-avatar-storage";

export async function uploadOperatorAvatar(
  auth: TenantAuthContext,
  body: Buffer,
  contentType: string
): Promise<OperatorProfileResponse> {
  const repo = getIdentityRepository();
  const membership = await repo.findMembership(auth.userId, auth.tenantId);
  if (membership === null) {
    throw new MembershipNotFoundError(auth.userId);
  }

  const { storageKey } = await putOperatorAvatar({
    tenantId: auth.tenantId,
    userId: auth.userId,
    body,
    contentType,
  });

  const existingKey = membership.avatar?.storageKey?.trim() ?? "";
  if (existingKey.length > 0 && existingKey !== storageKey) {
    try {
      await deleteOperatorAvatarObject({
        tenantId: auth.tenantId,
        userId: auth.userId,
        storageKey: existingKey,
      });
    } catch {
      // Best-effort — metadata row is SoT.
    }
  }

  await repo.updateMembershipAvatar(auth.tenantId, auth.userId, {
    storageKey,
    contentType: contentType.trim().toLowerCase(),
  });

  return getOperatorProfile(auth);
}

export async function removeOperatorAvatar(auth: TenantAuthContext): Promise<OperatorProfileResponse> {
  const repo = getIdentityRepository();
  const membership = await repo.findMembership(auth.userId, auth.tenantId);
  if (membership === null) {
    throw new MembershipNotFoundError(auth.userId);
  }

  const existingKey = membership.avatar?.storageKey?.trim() ?? "";
  if (existingKey.length === 0) {
    throw new Error("OPERATOR_AVATAR_NOT_SET");
  }

  try {
    await deleteOperatorAvatarObject({
      tenantId: auth.tenantId,
      userId: auth.userId,
      storageKey: existingKey,
    });
  } catch {
    // Best-effort delete — metadata clear still proceeds.
  }

  await repo.updateMembershipAvatar(auth.tenantId, auth.userId, null);
  return getOperatorProfile(auth);
}

export async function resolveOperatorAvatarUrl(
  auth: TenantAuthContext
): Promise<{ readonly url: string; readonly storageKey: string }> {
  const repo = getIdentityRepository();
  const membership = await repo.findMembership(auth.userId, auth.tenantId);
  if (membership === null) {
    throw new MembershipNotFoundError(auth.userId);
  }

  const storageKey = membership.avatar?.storageKey?.trim() ?? "";
  if (storageKey.length === 0) {
    throw new Error("OPERATOR_AVATAR_NOT_SET");
  }

  const url = await getOperatorAvatarSignedReadUrl({
    tenantId: auth.tenantId,
    userId: auth.userId,
    storageKey,
  });
  return { url, storageKey };
}
