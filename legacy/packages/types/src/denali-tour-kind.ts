/**
 * Denali wizard tour kind slugs (8 values). Stored in UI and
 * `tripDetails.overview.denaliTourKind`; mapped to API `TourType` + `isMultiDay` in the web mapper.
 * @see docs/20-architecture/denali-wizard-field-mapping.md
 */
export const DENALI_TOUR_KIND_VALUES = [
  "mountain_day",
  "mountain_multi",
  "nature_day",
  "nature_multi",
  "desert_day",
  "desert_multi",
  "event_reading",
  "event_cinema",
] as const;

export type DenaliTourKind = (typeof DENALI_TOUR_KIND_VALUES)[number];

const DENALI_TOUR_KIND_SET = new Set<string>(DENALI_TOUR_KIND_VALUES);

export function isDenaliTourKind(value: unknown): value is DenaliTourKind {
  return typeof value === "string" && DENALI_TOUR_KIND_SET.has(value);
}

/** Derived flag for Denali basic tab (must match `tourType` slug suffix). */
export function denaliTourKindToIsMultiDay(kind: DenaliTourKind): boolean {
  return kind.endsWith("_multi");
}

export function isDenaliEventTourKind(kind: DenaliTourKind): boolean {
  return kind === "event_reading" || kind === "event_cinema";
}

export function isDenaliOutdoorTourKind(kind: DenaliTourKind): boolean {
  return !isDenaliEventTourKind(kind);
}
