import type { PatchUserRewardsRequest, UsersDirectoryRow } from "./users-directory-types";

export const LOYALTY_REWARD_BADGE_IDS = ["VIP_MEMBER", "GOLD_CLUB"] as const;
export type LoyaltyRewardBadgeId = (typeof LOYALTY_REWARD_BADGE_IDS)[number];
export type LoyaltyTier = "none" | LoyaltyRewardBadgeId;

export type UserRowMicroBadge =
  | { readonly kind: "discount"; readonly value: number }
  | { readonly kind: "loyalty"; readonly badgeId: LoyaltyRewardBadgeId }
  | { readonly kind: "label"; readonly text: string }
  | { readonly kind: "selectableLeader" }
  | { readonly kind: "leaderBuddy" };

const LOYALTY_BADGE_IDS = new Set<string>(LOYALTY_REWARD_BADGE_IDS);

function preserveNonLoyaltyRewardBadges(
  badges: readonly string[] | undefined
): readonly string[] {
  return (badges ?? []).filter((badge) => !LOYALTY_BADGE_IDS.has(badge));
}

const MAX_REWARD_LABELS = 32;
const MAX_REWARD_LABEL_LENGTH = 64;

export function resolveLoyaltyTierFromBadges(
  badges: readonly string[] | undefined
): LoyaltyTier {
  if (badges?.includes("GOLD_CLUB")) {
    return "GOLD_CLUB";
  }
  if (badges?.includes("VIP_MEMBER")) {
    return "VIP_MEMBER";
  }
  return "none";
}

export function normalizeRewardLabel(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_REWARD_LABEL_LENGTH) {
    return null;
  }
  return trimmed;
}

export function addRewardLabel(labels: readonly string[], raw: string): readonly string[] {
  const next = normalizeRewardLabel(raw);
  if (next === null || labels.includes(next) || labels.length >= MAX_REWARD_LABELS) {
    return labels;
  }
  return [...labels, next];
}

export function removeRewardLabel(labels: readonly string[], index: number): readonly string[] {
  if (index < 0 || index >= labels.length) {
    return labels;
  }
  return labels.filter((_, labelIndex) => labelIndex !== index);
}

export function buildRewardBadgesFromLoyaltyTier(tier: LoyaltyTier): readonly string[] {
  return tier === "none" ? [] : [tier];
}

export function collectUserRowMicroBadges(user: UsersDirectoryRow): readonly UserRowMicroBadge[] {
  const badges: UserRowMicroBadge[] = [];
  const discount = user.permanentDiscountPercentage;
  if (discount !== null && discount !== undefined && discount > 0) {
    badges.push({ kind: "discount", value: discount });
  }
  const loyaltyTier = resolveLoyaltyTierFromBadges(user.rewardBadges);
  if (loyaltyTier !== "none") {
    badges.push({ kind: "loyalty", badgeId: loyaltyTier });
  }
  for (const label of user.labels ?? []) {
    badges.push({ kind: "label", text: label });
  }
  if (user.isSelectableLeader) {
    badges.push({ kind: "selectableLeader" });
  }
  if (user.rewardBadges?.includes("LEADER_BUDDY")) {
    badges.push({ kind: "leaderBuddy" });
  }
  return badges;
}

export function buildRewardsPatchPayload(input: {
  readonly previous: UsersDirectoryRow;
  readonly discountRaw: string;
  readonly loyaltyTier: LoyaltyTier;
  readonly labels: readonly string[];
  readonly selectableLeader: boolean;
  readonly leaderBuddy: boolean;
}):
  | { readonly ok: true; readonly payload: PatchUserRewardsRequest }
  | { readonly ok: false; readonly error: "discountRange" } {
  const basePayload: PatchUserRewardsRequest = {
    isSelectableLeader: input.selectableLeader,
    badges: [
      ...buildRewardBadgesFromLoyaltyTier(input.loyaltyTier),
      ...preserveNonLoyaltyRewardBadges(input.previous.rewardBadges).filter(
        (badge) => badge !== "LEADER_BUDDY"
      ),
      ...(input.leaderBuddy ? (["LEADER_BUDDY"] as const) : []),
    ],
    labels: [...input.labels],
  };

  const trimmed = input.discountRaw.trim();
  if (trimmed.length > 0) {
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
      return { ok: false, error: "discountRange" };
    }
    return {
      ok: true,
      payload: { ...basePayload, permanentDiscountPercentage: parsed },
    };
  }
  if (
    input.previous.permanentDiscountPercentage !== null &&
    input.previous.permanentDiscountPercentage !== undefined
  ) {
    return {
      ok: true,
      payload: { ...basePayload, permanentDiscountPercentage: null },
    };
  }

  return { ok: true, payload: basePayload };
}
