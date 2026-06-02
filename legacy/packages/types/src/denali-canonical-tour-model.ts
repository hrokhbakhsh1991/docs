import type { TourType } from "./tour-classification";
import type { DenaliTourKind } from "./denali-tour-kind";

/**
 * Denali MVP canonical domain model.
 *
 * Replaces the wizard form shape (`DenaliCreateTourWizardForm`) with fewer,
 * non-redundant user inputs. Legacy slugs and ghost fields are derived at the
 * adapter boundary (form ↔ API), not stored in this model.
 *
 * @see docs/architecture/denali-canonical-domain-model.md
 */

/** Product category — one control instead of 8 `denaliTourKind` slugs. */
export type DenaliTourCategory = "mountain" | "nature" | "desert" | "event";

export const DENALI_TOUR_CATEGORY_VALUES = ["mountain", "nature", "desert", "event"] as const;

/** Schedule duration — one control instead of `isMultiDay` + slug suffix. */
export type DenaliTourDuration = "single_day" | "multi_day";

export const DENALI_TOUR_DURATION_VALUES = ["single_day", "multi_day"] as const;

/** Event sub-type when {@link DenaliCanonicalTourModel.category} is `"event"`. */
export type DenaliEventVariant = "reading" | "cinema";

export const DENALI_EVENT_VARIANT_VALUES = ["reading", "cinema"] as const;

/** Canonical basics slice stored indirectly as legacy `denaliTourKind` in the wizard form. */
export type DenaliCanonicalBasicsSelection = {
  category: DenaliTourCategory;
  duration: DenaliTourDuration;
  eventVariant?: DenaliEventVariant;
};

export type DenaliDifficultyLevel = "easy" | "medium" | "hard";
export type DenaliFitnessLevel = "low" | "medium" | "high";

/** Simplified transport for MVP (replaces mode + privateCar matrix). */
export type DenaliMobilityMode = "organizer_vehicle" | "participant_cars" | "private_car_only" | "none";

/**
 * Minimal stable tour model for Denali create/edit MVP.
 * Only {@link DenaliFieldKind} `user_input` fields appear here.
 */
export interface DenaliCanonicalTourModel {
  basics: {
    title: string;
    category: DenaliTourCategory;
    duration: DenaliTourDuration;
    /** Required when `category === "event"`. */
    eventVariant?: DenaliEventVariant;
    destinationId: string;
    schedule: {
      startsAt: string;
      /** Required when `duration === "multi_day"`. */
      endsAt?: string;
    };
    capacity: {
      max: number;
      min?: number;
    };
    meetingPoint?: string;
  };

  program: {
    /** Workspace theme catalog id (marketing label — not the same as `category`). */
    mainThemeId: string;
    shortDescription: string;
    longDescription?: string;
    /**
     * Outdoor programs only (`mountain` | `nature` | `desert`).
     * Omit for `category === "event"`.
     */
    outdoorDetails?: {
      difficultyLevel: DenaliDifficultyLevel;
      hikingHoursApprox: number;
    };
  };

  transport: {
    mobility: DenaliMobilityMode;
    description?: string;
    /**
     * Toman per seat when `mobility === "participant_cars"` and cost-sharing applies.
     */
    carshareAmountPerSeat?: number;
    notes?: string;
  };

  pricing: {
    isPaid: boolean;
    pricePerPerson?: number;
  };

  requirements: {
    minAge?: number;
    maxAge?: number;
    /**
     * Meaningful for outdoor / mountain; required when `category === "mountain"` (product rule).
     */
    fitnessLevel?: DenaliFitnessLevel;
    sportsInsuranceRequired?: boolean;
    medicalNotes?: string;
    technicalNotes?: string;
  };

  /** MVP: single optional block; replaces five separate policy textareas. */
  policies?: {
    notes?: string;
  };
}

/** Classification of fields in the legacy wizard form vs canonical model. */
export type DenaliFieldKind = "user_input" | "derived" | "internal_only";

/**
 * Values computed from canonical inputs for API / persistence adapters.
 * Not part of `DenaliCanonicalTourModel` — produced by `deriveDenaliPersistenceView`.
 */
export interface DenaliDerivedPersistenceView {
  /** Legacy slug for `tripDetails.overview.denaliTourKind` round-trip. */
  denaliTourKind: DenaliTourKind;
  apiTourType: TourType;
  isMultiDay: boolean;
  difficultyType: "physical" | "none";
  paymentMode: "offline_receipt";
}

export function isDenaliOutdoorCategory(
  category: DenaliTourCategory,
): category is "mountain" | "nature" | "desert" {
  return category !== "event";
}

export function denaliCategoryRequiresEventVariant(category: DenaliTourCategory): boolean {
  return category === "event";
}

/** Derive legacy `denaliTourKind` slug from canonical category + duration + event variant. */
/** Inverse of {@link denaliTourKindFromCanonical} for wizard UI controls. */
export function denaliCanonicalBasicsFromTourKind(
  kind: DenaliTourKind | undefined,
): DenaliCanonicalBasicsSelection | null {
  if (kind == null) return null;
  if (kind === "event_cinema") {
    return { category: "event", duration: "single_day", eventVariant: "cinema" };
  }
  if (kind === "event_reading") {
    return { category: "event", duration: "single_day", eventVariant: "reading" };
  }
  const duration: DenaliTourDuration = kind.endsWith("_multi") ? "multi_day" : "single_day";
  if (kind.startsWith("mountain_")) return { category: "mountain", duration };
  if (kind.startsWith("nature_")) return { category: "nature", duration };
  if (kind.startsWith("desert_")) return { category: "desert", duration };
  return null;
}

export function isDenaliMountainCategory(category: DenaliTourCategory): boolean {
  return category === "mountain";
}

export function denaliTourKindFromCanonical(input: {
  category: DenaliTourCategory;
  duration: DenaliTourDuration;
  eventVariant?: DenaliEventVariant;
}): DenaliTourKind {
  const multi = input.duration === "multi_day";
  switch (input.category) {
    case "mountain":
      return multi ? "mountain_multi" : "mountain_day";
    case "nature":
      return multi ? "nature_multi" : "nature_day";
    case "desert":
      return multi ? "desert_multi" : "desert_day";
    case "event": {
      const variant = input.eventVariant ?? "reading";
      if (variant === "cinema") return "event_cinema";
      return "event_reading";
    }
    default: {
      const _exhaustive: never = input.category;
      return _exhaustive;
    }
  }
}

export function denaliApiTourTypeFromCategory(category: DenaliTourCategory): TourType {
  switch (category) {
    case "mountain":
      return "mountain";
    case "nature":
      return "nature";
    case "desert":
      return "desert";
    case "event":
      return "cultural";
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

export function denaliDifficultyTypeFromCategory(
  category: DenaliTourCategory,
): "physical" | "none" {
  return category === "event" ? "none" : "physical";
}

export function deriveDenaliPersistenceView(
  model: Pick<DenaliCanonicalTourModel, "basics">,
): DenaliDerivedPersistenceView {
  const { category, duration, eventVariant } = model.basics;
  return {
    denaliTourKind: denaliTourKindFromCanonical({ category, duration, eventVariant }),
    apiTourType: denaliApiTourTypeFromCategory(category),
    isMultiDay: duration === "multi_day",
    difficultyType: denaliDifficultyTypeFromCategory(category),
    paymentMode: "offline_receipt",
  };
}
