import type { TourType } from "./tour-classification";

/** Monotonic: bump when profile semantics or default step visibility change (draft / clone snapshot). */
export const TOUR_FORM_PROFILE_VERSION = 1 as const;

/**
 * Closed set of tour **creation form** profiles. Workspace themes bind to one value via `form_profile`.
 * @see docs/20-architecture/tour-wizard-field-groups.md
 */
export const TOUR_FORM_PROFILE_VALUES = [
  "general",
  "mountain_outdoor",
  "nature_trip",
  "urban_event",
  "cinema_event",
  "cultural_tour",
] as const;

export type TourFormProfile = (typeof TOUR_FORM_PROFILE_VALUES)[number];

/**
 * Shared array for Nest `@IsIn`, Swagger `enum`, and other runtimes that want a normal
 * `readonly TourFormProfile[]` without repeating `[...TOUR_FORM_PROFILE_VALUES]` at every DTO.
 * **Source of truth** for membership remains {@link TOUR_FORM_PROFILE_VALUES} — extend that
 * tuple only; this list is derived once at module load.
 */
export const TOUR_FORM_PROFILE_VALUES_LIST: readonly TourFormProfile[] = [...TOUR_FORM_PROFILE_VALUES];

const PROFILE_SET = new Set<string>(TOUR_FORM_PROFILE_VALUES);

export const DEFAULT_TOUR_FORM_PROFILE: TourFormProfile = "general";

export function isTourFormProfile(value: unknown): value is TourFormProfile {
  return typeof value === "string" && PROFILE_SET.has(value);
}

export function normalizeTourFormProfileInput(value: unknown): TourFormProfile {
  if (isTourFormProfile(value)) {
    return value;
  }
  return DEFAULT_TOUR_FORM_PROFILE;
}

/** When no theme profile is available, map commercial `tourType` to a sensible default profile. */
export function defaultTourFormProfileForTourType(tourType: TourType | null | undefined): TourFormProfile {
  switch (tourType) {
    case "mountain":
      return "mountain_outdoor";
    case "nature":
      return "nature_trip";
    case "city":
      return "urban_event";
    case "cultural":
      return "cultural_tour";
    case "desert":
      return "nature_trip";
    default:
      return "general";
  }
}
