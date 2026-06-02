/** Allowed tour-level transport options (multi-select). No `mixed` — combine several modes instead. */
export const TOUR_TRANSPORT_MODE_VALUES = ["bus", "train", "plane", "private_car"] as const;
export type TourTransportMode = (typeof TOUR_TRANSPORT_MODE_VALUES)[number];

/**
 * Lowercase, trim, stable sort. **Does not** drop unknown tokens — `@IsIn(..., { each: true })`
 * must still reject values outside {@link TOUR_TRANSPORT_MODE_VALUES}.
 */
export function normalizeTourTransportModesInput(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const v = item.trim().toLowerCase();
    if (v.length > 0) out.push(v);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * DTO transform: `undefined` = omit field; `null` = clear to empty array (PATCH);
 * arrays are normalized; non-arrays become `undefined` so `@IsOptional` skips or later validators fail.
 */
export function normalizeTourTransportModesForDto(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return [];
  }
  return normalizeTourTransportModesInput(value);
}
