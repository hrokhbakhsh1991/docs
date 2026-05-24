/**
 * Phase 4 migration step 1: canonical model introduced, not wired yet.
 *
 * MVP product model for the Denali create wizard — only fields the user sees on the
 * 5-step rail. Not the legacy RHF form shape; not API persistence (`denaliTourKind`, etc.).
 *
 * @see packages/types/src/denali-canonical-tour-model.ts — prior nested model (superseded in Phase 4)
 */

import type { TourType } from "../tour-classification";
import type { DenaliTourKind } from "../denali-tour-kind";
import type { DenaliLocationData } from "./locationData";

export type { DenaliLocationData, DenaliLocationZoneKey } from "./locationData";
export { DENALI_LOCATION_ZONE_KEYS } from "./locationData";

export type DenaliCanonicalCategory = "mountain" | "nature" | "desert" | "event";

export const DENALI_CANONICAL_CATEGORY_VALUES = [
  "mountain",
  "nature",
  "desert",
  "event",
] as const;

/** Product duration control (not `single_day` / `multi_day` form tokens). */
export type DenaliCanonicalDuration = "single" | "multi";

export const DENALI_CANONICAL_DURATION_VALUES = ["single", "multi"] as const;

/** Product category — one control instead of 8 `denaliTourKind` slugs. */
export type DenaliTourCategory = DenaliCanonicalCategory;

export const DENALI_TOUR_CATEGORY_VALUES = DENALI_CANONICAL_CATEGORY_VALUES;

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

export type DenaliCanonicalTransportMode =
  | "organizer_vehicle"
  | "bus"
  | "minibus"
  | "train"
  | "shared_cars"
  | "none";

export const DENALI_CANONICAL_TRANSPORT_MODE_VALUES = [
  "organizer_vehicle",
  "bus",
  "minibus",
  "train",
  "shared_cars",
  "none",
] as const;

export type { DenaliGatheringPickupStation } from "./gatheringPickupStation";
export { EMPTY_GATHERING_PICKUP_STATION } from "./gatheringPickupStation";

/** @deprecated Use {@link DenaliGatheringPickupStation}. */
export type DenaliGatheringPointStation = import("./gatheringPickupStation").DenaliGatheringPickupStation;

/**
 * Canonical Denali tour — MVP wizard user inputs only.
 */
export interface DenaliCanonicalTourModel {
  category: DenaliCanonicalCategory;
  duration: DenaliCanonicalDuration;

  title: string;
  destinationId: string;
  startDateTime: string;
  endDateTime?: string;
  /** Omitted when unset on form; Zod submit requires integer ≥ 1. */
  capacityMax?: number;
  capacityMin?: number;
  meetingPoint?: string;
  /** Start location (village, square, trailhead, base camp, etc.). */
  startPointLocationText?: string;
  /** @deprecated Read via `gatheringPoints`; not written on new saves. */
  gatheringPoint?: DenaliLocationData;
  /** Multi-station pickups (`tripDetails.logistics.gatheringPoints`). */
  gatheringPoints?: import("./gatheringPickupStation").DenaliGatheringPickupStation[];
  /** Trailhead where hiking begins. */
  startPoint?: DenaliLocationData;
  /** Geographical peak coordinate. */
  summitPoint?: DenaliLocationData;
  /** Optional overnight camp / shelter. */
  campPoint?: DenaliLocationData;
  /** Final pick-up zone (maps to legacy logistics `returnPoint` when unset). */
  endPoint?: DenaliLocationData;
  /** Approximate return clock time (24h HH:mm), not full end datetime. */
  approximateReturnTime?: string;
  /** Workspace user ids assigned as tour leaders / crew (multi-select). */
  leaderUserIds?: string[];
  /** When true, a local (non-workspace) guide is required on this tour. */
  requiresLocalGuide?: boolean;
  /** Display name for the local guide when `requiresLocalGuide` is set. */
  localGuideName?: string;
  /** When true, registrations need admin approval before confirmation (Telegram workflow). */
  requiresManualAdminApproval?: boolean;
  /** Wizard-only: maps to API `lifecycle_status` on submit (`draft` → DRAFT, `active` → OPEN). */
  publishStatus?: "draft" | "active";
  /** Coordination channel URL (primary wire: `chat_link` from Telegram, Bale, Eitaa, Instagram, etc.). */
  socialMediaLink?: string;

  program: {
    /** Workspace theme catalog ids — marketing tags only (not form invariants). */
    themeIds: string[];
    shortDescription: string;
    longDescription?: string;
    /** Outdoor programs only (1-10 scale). */
    difficultyLevel?: number;
    /** Outdoor programs only. */
    hikingHoursApprox?: number;
    /** Outbound hiking hours (outdoor categories). */
    hikingGoHours?: number;
    /** Return hiking hours (outdoor categories). */
    hikingReturnHours?: number;
    /** Mountain category only. */
    altitudeMeasurement?: number;
    /** Dynamic daily activities for multi-day tours. */
    itinerary?: Array<{
      day: number;
      activities: string;
      /** Optional stop / area label for multi-stop routing within the tour window. */
      locationText?: string;
      /** Optional structured geolocation pin for the day's stop. */
      location?: DenaliLocationData;
      photos?: Array<{
        id: string;
        url: string;
        filename?: string;
        size?: number;
        mimeType?: string;
        uploadedAt?: string;
      }>;
    }>;
  };

  transport: {
    mode: DenaliCanonicalTransportMode;
    /** Organizer transport fee per person (Toman) — not دنگ. */
    transportCost?: number;
    /** Bus/minibus/train — permission for participants to use a personal car. */
    allowPersonalCar?: boolean;
    /** Personal car fuel share (دنگ) — only when `shared_cars` or `allowPersonalCar`. */
    dongAmount?: number;
    transportNotes?: string;
    /** Train-only: window / aisle / any seat preference. */
    seatPreference?: "window" | "aisle" | "any";
  };

  pricing: {
    requiresPayment?: boolean;
    basePricePerPerson?: number;
    paymentMode: "offline_receipt";
    /** Organizer includes group liability insurance in the tour package. */
    includesTourInsurance?: boolean;
  };

  participants: {
    minimumAge?: number;
    maximumAge?: number;
    /** Outdoor programs only. */
    fitnessLevel?: "low" | "medium" | "high";
    /** Checkout must collect national ID on the participant profile. */
    nationalIdRequired?: boolean;
    sportsInsuranceRequired?: boolean;
    /** Free-text fitness / experience prerequisites. */
    fitnessPrerequisiteText?: string;
    /** Gear items selected from workspace settings. */
    gearItems?: Array<{
      id: string;
      isRequired: boolean;
    }>;
    /** Auto-accept returning climbers with at least this many past peaks with the agency (1–4). */
    minRequiredPeaks?: number;
  };

  policies: {
    policiesText?: string;
    /** Hours before departure when cancellation penalty applies. */
    cancellationDeadlineHours?: number;
    /** Penalty percentage (0–100) when cancelling inside the deadline window. */
    cancellationPenaltyPercentage?: number;
  };

  photos?: Array<{
    id: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  }>;
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
  duration: DenaliCanonicalDuration | DenaliTourDuration;
  eventVariant?: DenaliEventVariant;
}): DenaliTourKind {
  const multi = input.duration === "multi" || input.duration === "multi_day";
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
