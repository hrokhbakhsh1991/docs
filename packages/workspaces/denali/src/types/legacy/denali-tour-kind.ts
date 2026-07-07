/** Denali wizard tour kind slugs (10 values). */
export const DENALI_TOUR_KIND_VALUES = [
  "mountain_day",
  "mountain_multi",
  "nature_day",
  "nature_multi",
  "desert_day",
  "desert_multi",
  "event_reading",
  "event_reading_multi",
  "event_cinema",
  "event_cinema_multi",
] as const;

export type DenaliTourKind = (typeof DENALI_TOUR_KIND_VALUES)[number];

const DENALI_TOUR_KIND_SET = new Set<string>(DENALI_TOUR_KIND_VALUES);

export function isDenaliTourKind(value: unknown): value is DenaliTourKind {
  return typeof value === "string" && DENALI_TOUR_KIND_SET.has(value);
}

export function denaliTourKindToIsMultiDay(kind: DenaliTourKind | undefined | null): boolean {
  return typeof kind === "string" && kind.endsWith("_multi");
}

export function isDenaliEventTourKind(kind: DenaliTourKind): boolean {
  return kind.startsWith("event_");
}

export function isDenaliOutdoorTourKind(kind: DenaliTourKind): boolean {
  return !isDenaliEventTourKind(kind);
}
