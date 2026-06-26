import {
  isOperatorProfileGender,
  type OperatorMembershipAvatar,
  type OperatorProfileGender,
} from "@app-tour/workspace-sdk";
import type { Prisma } from "@prisma/client";

import type { MembershipRewardsRecord } from "./in-memory-identity.repository";

export type MembershipMetadataFields = {
  readonly displayName?: string;
  readonly email?: string;
  readonly gender?: OperatorProfileGender;
  readonly rewards?: MembershipRewardsRecord;
  readonly avatar?: OperatorMembershipAvatar;
};

function readRewards(metadata: Prisma.JsonValue | undefined): MembershipRewardsRecord | undefined {
  if (
    metadata === null ||
    metadata === undefined ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return undefined;
  }
  const record = metadata as Record<string, unknown>;
  const rewards: MembershipRewardsRecord = {};
  if ("permanentDiscountPercentage" in record) {
    const value = record.permanentDiscountPercentage;
    rewards.permanentDiscountPercentage =
      value === null || typeof value === "number" ? value : undefined;
  }
  if (Array.isArray(record.badges)) {
    rewards.badges = record.badges.filter((badge): badge is string => typeof badge === "string");
  }
  if (typeof record.isSelectableLeader === "boolean") {
    rewards.isSelectableLeader = record.isSelectableLeader;
  }
  if (Array.isArray(record.labels)) {
    rewards.labels = record.labels.filter((label): label is string => typeof label === "string");
  }
  return Object.keys(rewards).length > 0 ? rewards : undefined;
}

function readAvatar(record: Record<string, unknown>): OperatorMembershipAvatar | undefined {
  const raw = record.avatar;
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const avatarRecord = raw as Record<string, unknown>;
  const storageKey =
    typeof avatarRecord.storageKey === "string" ? avatarRecord.storageKey.trim() : "";
  if (storageKey.length === 0) {
    return undefined;
  }
  const contentType =
    typeof avatarRecord.contentType === "string" && avatarRecord.contentType.trim().length > 0
      ? avatarRecord.contentType.trim().toLowerCase()
      : undefined;
  return {
    storageKey,
    ...(contentType !== undefined ? { contentType } : {}),
  };
}

export function readMembershipMetadata(
  metadata: Prisma.JsonValue | undefined
): MembershipMetadataFields {
  if (
    metadata === null ||
    metadata === undefined ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return {};
  }
  const record = metadata as Record<string, unknown>;
  const displayName =
    typeof record.displayName === "string" && record.displayName.trim().length > 0
      ? record.displayName.trim()
      : undefined;
  const email =
    typeof record.email === "string" && record.email.trim().length > 0
      ? record.email.trim()
      : undefined;
  const rewards = readRewards(metadata);
  const avatar = readAvatar(record);
  const gender =
    typeof record.gender === "string" && isOperatorProfileGender(record.gender)
      ? record.gender
      : undefined;
  return {
    ...(displayName !== undefined ? { displayName } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(gender !== undefined ? { gender } : {}),
    ...(rewards !== undefined ? { rewards } : {}),
    ...(avatar !== undefined ? { avatar } : {}),
  };
}

function writeRewards(rewards: MembershipRewardsRecord): Prisma.InputJsonObject {
  return {
    ...(rewards.permanentDiscountPercentage !== undefined
      ? { permanentDiscountPercentage: rewards.permanentDiscountPercentage }
      : {}),
    ...(rewards.badges !== undefined ? { badges: [...rewards.badges] } : {}),
    ...(rewards.isSelectableLeader !== undefined
      ? { isSelectableLeader: rewards.isSelectableLeader }
      : {}),
    ...(rewards.labels !== undefined ? { labels: [...rewards.labels] } : {}),
  };
}

function writeAvatar(avatar: OperatorMembershipAvatar): Prisma.InputJsonObject {
  return {
    storageKey: avatar.storageKey,
    ...(avatar.contentType !== undefined && avatar.contentType.length > 0
      ? { contentType: avatar.contentType }
      : {}),
  };
}

export function writeMembershipMetadata(input: MembershipMetadataFields): Prisma.InputJsonObject {
  return {
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.email !== undefined && input.email.length > 0 ? { email: input.email } : {}),
    ...(input.gender !== undefined ? { gender: input.gender } : {}),
    ...(input.rewards !== undefined ? writeRewards(input.rewards) : {}),
    ...(input.avatar !== undefined ? { avatar: writeAvatar(input.avatar) } : {}),
  };
}

export function mergeMembershipMetadata(
  existing: Prisma.JsonValue | undefined,
  patch: Partial<MembershipMetadataFields> & {
    readonly avatar?: OperatorMembershipAvatar | null;
    readonly gender?: OperatorProfileGender | null;
  }
): Prisma.InputJsonObject {
  const current = readMembershipMetadata(existing);
  const nextAvatar =
    patch.avatar === null ? undefined : patch.avatar !== undefined ? patch.avatar : current.avatar;
  const nextGender =
    patch.gender === null ? undefined : patch.gender !== undefined ? patch.gender : current.gender;
  return writeMembershipMetadata({
    displayName: patch.displayName !== undefined ? patch.displayName : current.displayName,
    email: patch.email !== undefined ? patch.email : current.email,
    rewards: patch.rewards !== undefined ? patch.rewards : current.rewards,
    ...(nextGender !== undefined ? { gender: nextGender } : {}),
    ...(nextAvatar !== undefined ? { avatar: nextAvatar } : {}),
  });
}

export function writePublicProfileMetadata(input: {
  readonly displayName: string;
  readonly email?: string;
  readonly existingMetadata?: Prisma.JsonValue;
}): Prisma.InputJsonObject {
  const existing = readMembershipMetadata(input.existingMetadata);
  return writeMembershipMetadata({
    displayName: input.displayName,
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(existing.gender !== undefined ? { gender: existing.gender } : {}),
    ...(existing.rewards !== undefined ? { rewards: existing.rewards } : {}),
    ...(existing.avatar !== undefined ? { avatar: existing.avatar } : {}),
  });
}
