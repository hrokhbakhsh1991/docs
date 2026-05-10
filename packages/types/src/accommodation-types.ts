/** Allowed `tripDetails.logistics.accommodationTypes` entries (multi-select). */
export const ACCOMMODATION_TYPE_VALUES = [
  "hotel",
  "hostel",
  "tent",
  "mountain_hut",
  "camp",
  "guesthouse"
] as const;

export type AccommodationTypeSlug = (typeof ACCOMMODATION_TYPE_VALUES)[number];

const SLUG_SET = new Set<string>(ACCOMMODATION_TYPE_VALUES);

/**
 * Parses legacy free-text `accommodationType` into known slugs and leftover copy for `accommodationNotes`.
 * Splits on `,` and `;`. Single unmatched phrase is treated as free-text remainder.
 */
export function parseLegacyAccommodationTypeString(raw: string): {
  types: AccommodationTypeSlug[];
  remainder: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { types: [], remainder: "" };
  }
  const parts = trimmed.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { types: [], remainder: "" };
  }

  const types: AccommodationTypeSlug[] = [];
  const unmatched: string[] = [];
  for (const part of parts) {
    const slug = part.toLowerCase().replace(/\s+/g, "_");
    if (SLUG_SET.has(slug)) {
      types.push(slug as AccommodationTypeSlug);
    } else {
      unmatched.push(part);
    }
  }

  if (types.length === 0 && parts.length === 1) {
    return { types: [], remainder: trimmed };
  }

  const uniqueSorted = [...new Set(types)].sort((a, b) => a.localeCompare(b));
  return {
    types: uniqueSorted,
    remainder: unmatched.length > 0 ? unmatched.join(", ") : ""
  };
}

/** Lowercase / trim / normalize spaces→underscore; stable sorted unique. Does not drop unknown tokens. */
export function normalizeAccommodationTypesInput(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const v = item.trim().toLowerCase().replace(/\s+/g, "_");
    if (v.length > 0) {
      out.push(v);
    }
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}

/**
 * DTO transform: `undefined` = omit; `null` = clear to empty array (PATCH);
 * arrays are normalized; non-arrays become `undefined`.
 */
export function normalizeAccommodationTypesForDto(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return [];
  }
  return normalizeAccommodationTypesInput(value);
}
