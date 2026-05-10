import { TOUR_AUDIENCE_GROUP_VALUES, type TourAudienceGroup } from "@repo/types";

/** Re-export for call sites that used the shorter name. */
export const AUDIENCE_GROUP_VALUES = TOUR_AUDIENCE_GROUP_VALUES;
export type AudienceGroup = TourAudienceGroup;

const KNOWN: ReadonlySet<string> = new Set<string>(AUDIENCE_GROUP_VALUES);

export function isAudienceGroup(value: unknown): value is AudienceGroup {
  return typeof value === "string" && KNOWN.has(value);
}

/**
 * Normalize raw input to a sorted, deduped list of known audience groups.
 * Legacy free-form values from older JSONB are dropped silently.
 */
export function normalizeAudienceGroups(value: unknown): AudienceGroup[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<AudienceGroup>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const v = item.trim().toLowerCase();
    if (KNOWN.has(v)) seen.add(v as AudienceGroup);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Returns the groups present in both arrays (overlap is invalid). */
export function findAudienceOverlap(
  suitableFor: readonly AudienceGroup[] | null | undefined,
  notSuitableFor: readonly AudienceGroup[] | null | undefined,
): AudienceGroup[] {
  if (!suitableFor?.length || !notSuitableFor?.length) return [];
  const a = new Set(suitableFor);
  return notSuitableFor.filter((g) => a.has(g));
}
