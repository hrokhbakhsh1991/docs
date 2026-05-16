/**
 * `user_tenants.membership_metadata` shape (Phase 6 — regional scoping).
 */
export type MembershipMetadata = {
  /** When actor has `tour.regional.manage`, tour list/detail are limited to these region ids. */
  allowedRegionIds?: string[];
  /** Explicit capability grants stored on membership (merged with labels / tenant modules). */
  capabilities?: string[];
};

export function parseMembershipMetadata(value: unknown): MembershipMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const raw = value as Record<string, unknown>;
  const allowedRegionIds = normalizeUuidList(raw.allowedRegionIds);
  const capabilities = normalizeStringList(raw.capabilities);
  return {
    ...(allowedRegionIds.length > 0 ? { allowedRegionIds } : {}),
    ...(capabilities.length > 0 ? { capabilities } : {}),
  };
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
