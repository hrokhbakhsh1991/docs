/**
 * `user_tenants.membership_metadata` shape (Phase 6 — regional scoping; Phase 14.6 — rewards).
 */
export const WORKSPACE_REWARD_BADGE_IDS = ["VIP_MEMBER", "LEADER_BUDDY"] as const;
export type WorkspaceRewardBadgeId = (typeof WORKSPACE_REWARD_BADGE_IDS)[number];

export type MembershipMetadata = {
  /** When actor has `tour.regional.manage`, tour list/detail are limited to these region ids. */
  allowedRegionIds?: string[];
  /** Explicit capability grants stored on membership (merged with labels / tenant modules). */
  capabilities?: string[];
  /** Owner-managed permanent discount percent (0–100) for this membership. */
  permanentDiscountPercentage?: number;
  /** Owner/admin-managed reward badge tags (see {@link WORKSPACE_REWARD_BADGE_IDS}). */
  badges?: string[];
};

export function parseMembershipMetadata(value: unknown): MembershipMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const raw = value as Record<string, unknown>;
  const allowedRegionIds = normalizeUuidList(raw.allowedRegionIds);
  const capabilities = normalizeStringList(raw.capabilities);
  const badges = normalizeRewardBadges(raw.badges);
  const permanentDiscountPercentage = normalizeDiscountPercentage(raw.permanentDiscountPercentage);
  return {
    ...(allowedRegionIds.length > 0 ? { allowedRegionIds } : {}),
    ...(capabilities.length > 0 ? { capabilities } : {}),
    ...(badges.length > 0 ? { badges } : {}),
    ...(permanentDiscountPercentage !== undefined ? { permanentDiscountPercentage } : {})
  };
}

export function normalizeDiscountPercentage(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

function normalizeRewardBadges(value: unknown): WorkspaceRewardBadgeId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowed = new Set<string>(WORKSPACE_REWARD_BADGE_IDS);
  const seen = new Set<string>();
  const out: WorkspaceRewardBadgeId[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim().toUpperCase();
    if (!allowed.has(trimmed) || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed as WorkspaceRewardBadgeId);
  }
  return out;
}

function normalizeUuidList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
