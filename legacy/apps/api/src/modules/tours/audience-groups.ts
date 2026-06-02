/**
 * Fixed audience groups used by the structured "suitable for / not suitable for" matrix
 * (`tripDetails.participation.suitableFor` / `tripDetails.participation.notSuitableFor`).
 *
 * UI shows two columns (suitable / not suitable) per group; storage is two arrays.
 * A given group MUST NOT appear in both arrays for the same tour
 * (enforced by {@link findAudienceOverlap} + class-validator on `TripDetailsParticipationDto`).
 *
 * Legacy free-form values from older payloads (e.g. `"family"`, `"kids_under_7"`) are
 * silently dropped on edit/save by {@link normalizeAudienceGroupsInput}.
 */
export const AUDIENCE_GROUP_VALUES = [
  "families",
  "solo_travelers",
  "seniors",
  "kids",
  "beginners",
  "experienced_hikers",
] as const;
export type AudienceGroup = (typeof AUDIENCE_GROUP_VALUES)[number];

const KNOWN: ReadonlySet<string> = new Set<string>(AUDIENCE_GROUP_VALUES);

/**
 * Trim, lowercase, drop empties, dedupe, drop unknown values, stable-sort.
 *
 * Returning a filtered array (instead of leaving validation to `@IsIn`) is intentional:
 * it lets us absorb legacy free-form tags from existing JSONB documents without
 * surfacing 400s to clients that just round-trip the old payload.
 */
export function normalizeAudienceGroupsInput(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const v = item.trim().toLowerCase();
    if (v.length === 0) continue;
    if (!KNOWN.has(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * DTO transform: `undefined` = omit; `null` = clear to empty array (PATCH);
 * arrays are normalized to known values.
 */
export function normalizeAudienceGroupsForDto(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  return normalizeAudienceGroupsInput(value);
}

/**
 * Throws when the same group appears in both arrays. Designed to be called from a service
 * layer or a class-validator constraint after both sides have been normalized.
 */
export function findAudienceOverlap(
  suitableFor: readonly string[] | null | undefined,
  notSuitableFor: readonly string[] | null | undefined,
): string[] {
  if (!suitableFor || !notSuitableFor) return [];
  const a = new Set(suitableFor);
  const overlap: string[] = [];
  for (const g of notSuitableFor) {
    if (a.has(g)) overlap.push(g);
  }
  return overlap;
}
